import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, move } from '../src/exploration.js';
import { PHOTOS } from '../src/photos.js';
import { createTimeline, getTimelineEntries } from '../src/timeline.js';
import { birthdayState, createPhotoAlbum, descendants, installJournalDOM, journalFixture, memory, walkTo } from './journal-fixture.js';

const photoById = id => PHOTOS.find(photo => photo.id === id);
const photoSrc = id => `/assets/${photoById(id).src}`;
const recordPreview = calls => (source, options) => calls.push({ source, ...options, src: source?.getAttribute('src') });

function albumFixture(t, initialState = birthdayState()) {
  const dom = installJournalDOM(t), previews = [];
  let state = initialState;
  const album = createPhotoAlbum({ getState: () => state, onPreview: recordPreview(previews) });
  return {
    ...dom, album, previews,
    setState: next => { state = next; },
    dialog: () => dom.nodes().find(node => node.tagName === 'dialog'),
    frame: () => dom.nodes().find(node => node.classList.contains('photo-album__frame')),
    image: () => dom.nodes().find(node => node.classList.contains('photo-album__image')),
    control: name => dom.nodes().find(node => node.dataset.albumControl === name),
  };
}

// The shared journal DOM supplies the real artwork, dialog, and event boundary;
// timeline only needs these additional platform hooks to open and close.
function timelineFixture(t, { onPreview, onRead, initialState } = {}) {
  const dom = installJournalDOM(t);
  window.addEventListener = () => {};
  dom.doc.querySelector = selector => selector === 'dialog[open]'
    ? dom.nodes().find(node => node.tagName === 'dialog' && node.open) ?? null
    : dom.doc.body.querySelector(selector);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  globalThis.cancelAnimationFrame = () => {};
  t.after(() => previous ? Object.defineProperty(globalThis, 'cancelAnimationFrame', previous) : delete globalThis.cancelAnimationFrame);
  let state = initialState ?? move(createInitialState(), memory('canteen'));
  const timeline = createTimeline({ getState: () => state, asset: file => `/assets/${file}`, onPreview, onRead });
  return { ...dom, timeline, get state() { return state; }, setState: next => { state = next; },
    dialog: () => dom.nodes().find(node => node.tagName === 'dialog') };
}

test('a revealed journal illustration previews its whole artwork while its separate read action still opens the memory', t => {
  const previews = [], reads = [];
  const view = journalFixture(t, createInitialState(), { onPreview: recordPreview(previews), onRead: tile => reads.push(tile.id) });
  view.journal.open();
  const card = view.card('school'), visual = card.querySelector('.keepsake-art'), artwork = visual.children[0];
  assert.equal(visual.tagName, 'button');
  assert.equal(visual.getAttribute('aria-label'), `放大插画：${memory('school').title}`);
  visual.emit('click', { target: artwork, detail: 1 });
  assert.equal(previews.length, 1);
  assert.equal(previews[0].source, artwork);
  assert.equal(previews[0].label, memory('school').title);
  assert.equal(previews[0].trigger, visual);
  assert.equal(view.dialog.open, true);
  assert.deepEqual(reads, []);
  card.querySelector('.keepsake-read').click();
  assert.deepEqual(reads, ['school']);
  assert.equal(view.dialog.open, false);
});

test('locked and sealed journal pages never preview before the page is actually revealed', t => {
  const previews = [], revealed = [];
  const view = journalFixture(t, createInitialState(), { onPreview: recordPreview(previews), onReveal: tile => revealed.push(tile.id) });
  view.journal.open();
  const locked = view.card('canteen').querySelector('.keepsake-art');
  assert.equal(locked.tagName, 'div');
  locked.emit('click', { target: locked.children[0], detail: 1 });
  assert.equal(previews.length, 0);
  view.setState(birthdayState()); view.journal.open();
  const envelope = view.card('dorm').querySelector('.keepsake-art');
  envelope.emit('click', { target: envelope.children[0], detail: 1 });
  assert.deepEqual(revealed, ['dorm']);
  assert.equal(previews.length, 0, 'the first click opens the envelope, not the preview');
  const visual = view.card('dorm').querySelector('.keepsake-art');
  visual.emit('click', { target: visual.children[0], detail: 1 });
  assert.equal(previews.length, 1);
  assert.equal(previews[0].source, visual.children[0]);
  assert.equal(view.dialog.open, true);
});

test('a two-character journal illustration forwards the complete gallery instead of just the clicked portrait', t => {
  const previews = [];
  const view = journalFixture(t, walkTo(createInitialState(), memory('honor')), { onPreview: recordPreview(previews) });
  view.journal.open();
  const visual = view.card('honor').querySelector('.keepsake-art'), gallery = visual.children[0];
  const portrait = descendants(gallery).find(node => node.tagName === 'img');
  assert.ok(portrait);
  visual.emit('click', { target: portrait, detail: 1 });
  assert.equal(previews.length, 1);
  assert.equal(previews[0].source, gallery);
  assert.ok(gallery.classList.contains('hero-gallery'));
  assert.equal(previews[0].label, memory('honor').title);
  assert.equal(view.dialog.open, true);
});

test('the current album photo supports click, Enter, and Space preview without closing or changing the selected photo', t => {
  const view = albumFixture(t);
  view.album.open({ ids: ['photo-01', 'photo-02'] });
  const frame = view.frame(), image = view.image();
  assert.equal(frame.getAttribute('role'), 'button');
  assert.equal(frame.getAttribute('tabindex'), '0');
  frame.focus();
  assert.equal(view.doc.activeElement, frame);
  frame.emit('click', { target: image, detail: 1 });
  for (const key of ['Enter', ' ']) {
    const event = frame.emit('keydown', { key, target: frame, detail: 0 });
    assert.equal(event.defaultPrevented, true);
  }
  assert.equal(view.previews.length, 3);
  for (const preview of view.previews) {
    assert.equal(preview.source, image);
    assert.equal(preview.trigger, frame);
    assert.equal(preview.label, photoById('photo-01').title);
    assert.equal(preview.src, photoSrc('photo-01'));
  }
  assert.equal(view.dialog().open, true);
  assert.equal(view.control('thumb-photo-01').getAttribute('aria-current'), 'true');
  frame.emit('keydown', { key: 'ArrowRight', detail: 0 });
  assert.equal(view.previews.length, 3);
});

test('album preview follows the current visible photo after navigation', t => {
  const view = albumFixture(t);
  view.album.open({ ids: ['photo-01', 'photo-02'] });
  view.control('next').click();
  view.frame().emit('click', { target: view.image(), detail: 1 });
  assert.equal(view.previews.length, 1);
  assert.equal(view.previews[0].src, photoSrc('photo-02'));
  assert.equal(view.previews[0].label, photoById('photo-02').title);
  assert.equal(view.dialog().open, true);
});

test('empty, failed, closed, and newly locked photos cannot enter preview', t => {
  const view = albumFixture(t, createInitialState());
  view.album.open();
  view.frame().emit('click', { detail: 1 });
  view.frame().emit('keydown', { key: 'Enter', detail: 0 });
  assert.equal(view.previews.length, 0);
  view.setState(birthdayState());
  view.album.open({ ids: ['photo-01'] });
  view.image().emit('error');
  view.frame().emit('click', { target: view.image(), detail: 1 });
  assert.equal(view.previews.length, 0);
  view.image().emit('load');
  view.frame().emit('click', { target: view.image(), detail: 1 });
  assert.equal(view.previews.length, 1);
  view.album.close();
  view.frame().emit('click', { target: view.image(), detail: 1 });
  assert.equal(view.previews.length, 1);
  view.album.open({ ids: ['photo-01'] });
  view.setState(createInitialState());
  view.frame().emit('click', { target: view.image(), detail: 1 });
  assert.equal(view.previews.length, 1, 'an already rendered photo must be authorized again when clicked');
});

test('the embedded journal photo section forwards preview and keeps its owning journal open', t => {
  const previews = [];
  const view = journalFixture(t, birthdayState(), { onPreview: recordPreview(previews) });
  view.journal.open({ tab: 'photos', ids: ['photo-01'] });
  const frame = view.dialog.querySelector('.photo-album__frame'), image = view.dialog.querySelector('.photo-album__image');
  frame.emit('click', { target: image, detail: 1 });
  assert.equal(previews.length, 1);
  assert.equal(previews[0].source, image);
  assert.equal(previews[0].trigger, frame);
  assert.equal(previews[0].label, photoById('photo-01').title);
  assert.equal(view.dialog.open, true);
  assert.equal(view.dialog.querySelector('.journal-photos').hidden, false);
  assert.equal(view.tab('photos').getAttribute('aria-selected'), 'true');
});

test('a thumbnail selects and previews its permitted photo and restores focus to the current thumbnail', t => {
  const view = albumFixture(t);
  view.album.open({ ids: ['photo-01', 'photo-02'] });
  const original = view.control('thumb-photo-02');
  original.emit('click', { target: original.children[0], detail: 1 });
  assert.equal(view.previews.length, 1);
  assert.equal(view.previews[0].source, view.image());
  assert.equal(view.previews[0].src, photoSrc('photo-02'));
  assert.equal(view.previews[0].label, photoById('photo-02').title);
  assert.equal(view.previews[0].trigger, view.control('thumb-photo-02'));
  assert.equal(view.previews[0].trigger.isConnected, true);
  assert.equal(view.control('thumb-photo-02').getAttribute('aria-current'), 'true');
  assert.equal(view.dialog().open, true);
});

test('timeline illustrations become native preview buttons without triggering the memory action or closing the timeline', t => {
  const previews = [], reads = [];
  const view = timelineFixture(t, { onPreview: recordPreview(previews), onRead: tile => reads.push(tile.id) });
  view.timeline.open();
  const dialog = view.dialog(), art = dialog.querySelector('.timeline-art'), entry = getTimelineEntries(view.state)[0];
  assert.equal(art.tagName, 'button');
  assert.equal(art.type, 'button');
  assert.equal(art.getAttribute('aria-label'), `放大插画：${entry.title}`);
  art.emit('click', { target: art.children[0], detail: 1 });
  assert.equal(previews.length, 1);
  assert.equal(previews[0].source, art.children[0]);
  assert.equal(previews[0].label, entry.title);
  assert.equal(previews[0].trigger, art);
  assert.equal(dialog.open, true);
  assert.deepEqual(reads, []);
  dialog.querySelector('.timeline-read').click();
  assert.deepEqual(reads, ['canteen']);
  assert.equal(dialog.open, false);
});

test('timeline artwork retains its passive presentation when no preview callback is supplied', t => {
  const view = timelineFixture(t);
  view.timeline.open();
  const art = view.dialog().querySelector('.timeline-art');
  assert.equal(art.tagName, 'div');
  assert.ok(art.children[0]);
  assert.equal(view.dialog().open, true);
});


test('the zero-turn timeline artwork previews only while its empty state is visibly open', t => {
  const previews = [];
  const view = timelineFixture(t, { initialState: createInitialState(), onPreview: recordPreview(previews) });
  view.timeline.open();
  const dialog = view.dialog(), empty = dialog.querySelector('.timeline-empty');
  const button = empty.querySelector('.timeline-empty-preview'), image = button.children[0];
  assert.equal(empty.hidden, false);
  assert.equal(button.tagName, 'button');
  assert.equal(button.type, 'button');
  assert.equal(button.getAttribute('aria-label'), '放大插画：小列车准备出发');
  button.emit('click', { target: image, detail: 1 });
  assert.equal(previews.length, 1);
  assert.equal(previews[0].source, image);
  assert.equal(previews[0].label, '小列车准备出发');
  assert.equal(previews[0].trigger, button);
  assert.equal(dialog.open, true, 'opening the picture must keep the zero-turn timeline underneath');
  view.timeline.close();
  button.emit('click', { target: image, detail: 1 });
  assert.equal(previews.length, 1, 'a closed timeline cannot reopen an old empty-state picture');
  view.setState(move(createInitialState(), memory('canteen')));
  view.timeline.open();
  assert.equal(dialog.open, true);
  assert.equal(empty.hidden, true);
  assert.equal(dialog.querySelector('.timeline-track').children.length, 1);
  button.emit('click', { target: image, detail: 1 });
  assert.equal(previews.length, 1, 'the hidden empty-state picture cannot preview after the first turn');
});
