import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, move, MEMORY_TILES } from '../src/exploration.js';
import { getBuildingPhotoIds, getUnlockedPhotos } from '../src/photo-access.js';
import { PHOTOS } from '../src/photos.js';
import { journalFixture, birthdayState, memory, getJournalPages } from './journal-fixture.js';

const photoSrc = photo => `/assets/${photo.src}`;
const thumbnailSrc = photo => `/assets/memories/thumbs/${photo.id}.webp`;

test('photo thumbnails request small variants while the selected photo keeps its original', t => {
  const view = journalFixture(t, birthdayState());
  view.journal.open({ tab: 'photos' });
  const thumbnail = view.control('thumb-photo-01').querySelector('img');
  assert.equal(thumbnail.src, '/assets/memories/thumbs/photo-01.webp');
  assert.equal(thumbnail.loading, 'lazy');
  assert.equal(view.dialog.querySelector('.photo-album__image').src, '/assets/memories/01.jpg');
  view.control('thumb-photo-27').click();
  assert.equal(view.dialog.querySelector('.photo-album__image').src, '/assets/memories/27.jpg');
});

test('an unavailable thumbnail falls back once to the original photo', t => {
  const view = journalFixture(t, birthdayState());
  view.journal.open({ tab: 'photos' });
  const thumbnail = view.control('thumb-photo-01').querySelector('img');
  assert.equal(thumbnail.src, '/assets/memories/thumbs/photo-01.webp');
  thumbnail.emit('error');
  assert.equal(thumbnail.src, '/assets/memories/01.jpg');
  const requestCount = view.loads.length;
  thumbnail.emit('error');
  assert.equal(view.loads.length, requestCount, 'a missing original must not cause an error loop');
});

test('a late thumbnail error rechecks the current journey before loading the original', t => {
  const view = journalFixture(t, birthdayState());
  view.journal.open({ tab: 'photos' });
  const thumbnail = view.control('thumb-photo-19').querySelector('img');
  view.setState(createInitialState());
  view.loads.length = 0;
  thumbnail.emit('error');
  assert.equal(view.loads.length, 0, 'a previously unlocked thumbnail cannot fetch an original after reset');
});

test('a newly registered photo without a generated thumbnail uses its original', t => {
  const item = PHOTOS.find(photo => photo.id === 'photo-01');
  const originalSrc = item.src;
  item.src = 'memories/newly-added.jpg';
  t.after(() => { item.src = originalSrc; });
  const view = journalFixture(t, birthdayState());
  view.journal.open({ tab: 'photos' });
  assert.equal(view.control('thumb-photo-01').querySelector('img').src, '/assets/memories/newly-added.jpg');
});

test('place albums open at the top with their photo tab focused, including after a previous scroll', t => {
  const view = journalFixture(t, move(createInitialState(), memory('canteen')));
  view.dialog.scrollTop = 450;
  view.journal.open({ tab: 'photos', buildingId: 'canteen' });
  assert.equal(view.dialog.scrollTop, 0);
  assert.equal(view.doc.activeElement, view.tab('photos'));
  assert.equal(view.dialog.querySelector('.photo-album__frame').scrollRequests?.length ?? 0, 0);
  view.journal.close();
  view.dialog.scrollTop = 320;
  view.journal.open({ tab: 'photos', buildingId: 'canteen' });
  assert.equal(view.dialog.scrollTop, 0);
  assert.equal(view.doc.activeElement, view.tab('photos'));
});

test('photo layout is scoped to its tab and switching tabs starts at the top', t => {
  const view = journalFixture(t, move(createInitialState(), memory('canteen')));
  view.journal.open({ tab: 'photos' });
  assert.equal(view.dialog.classList.contains('journal-dialog--photos'), true);
  view.dialog.scrollTop = 220;
  view.tab('all').click();
  assert.equal(view.dialog.scrollTop, 0);
  assert.equal(view.dialog.classList.contains('journal-dialog--photos'), false);
  view.journal.open({ tab: 'photos', buildingId: 'birthday' });
  assert.equal(view.dialog.scrollTop, 0);
  assert.equal(view.photoSources().length, 0);
});

test('the collection owns four accessible tabs and its photos never create another dialog', t => {
  const opened = [], view = journalFixture(t, createInitialState(), { onOpen: info => opened.push(info.tab) });
  view.journal.open();
  assert.equal(view.nodes().filter(node => node.tagName === 'dialog').length, 1);
  const tabs = view.dialog.querySelectorAll('[data-journal-filter]');
  assert.deepEqual(tabs.map(tab => tab.dataset.journalFilter), ['all', 'memories', 'eggs', 'photos']);
  assert.equal(view.dialog.querySelector('.journal-tabs').getAttribute('role'), 'tablist');
  assert.equal(view.tab('photos').getAttribute('role'), 'tab');
  assert.equal(view.tab('photos').getAttribute('tabindex'), '-1');
  assert.equal(view.dialog.querySelector('.photo-album__close'), null);
  assert.equal(view.photoSources().length, 0);
  view.tab('photos').click();
  assert.equal(view.dialog.open, true);
  assert.equal(view.tab('photos').getAttribute('aria-selected'), 'true');
  assert.equal(view.tab('photos').getAttribute('tabindex'), '0');
  assert.equal(view.dialog.querySelector('#journal-list').hidden, true);
  assert.equal(view.dialog.querySelector('.journal-photos').hidden, false);
  assert.equal(view.dialog.querySelector('.journal-reveal-bar').hidden, true);
  assert.deepEqual(opened, ['all', 'photos']);
  assert.equal(view.loads.some(src => src.includes('/photos/')), false);
  assert.match(view.dialog.querySelector('.photo-album__empty').textContent, /开车去更多地方/);
});

test('keyboard tab navigation selects a panel, moves focus and reports the opened tab', t => {
  const opened = [], view = journalFixture(t, createInitialState(), { onOpen: info => opened.push(info.tab) });
  view.journal.open();
  const end = view.tab('all').emit('keydown', { key: 'End' });
  assert.equal(end.defaultPrevented, true);
  assert.equal(view.doc.activeElement, view.tab('photos'));
  assert.equal(view.tab('photos').getAttribute('aria-selected'), 'true');
  view.tab('photos').emit('keydown', { key: 'ArrowRight' });
  assert.equal(view.doc.activeElement, view.tab('all'));
  assert.equal(view.tab('all').getAttribute('aria-selected'), 'true');
  assert.equal(view.dialog.querySelector('#journal-list').getAttribute('aria-labelledby'), view.tab('all').id);
  assert.deepEqual(opened, ['all', 'photos', 'all']);
});

test('building photos stay inside the collection and intersect the unlocked catalogue', t => {
  const state = move(createInitialState(), memory('canteen'));
  const view = journalFixture(t, state);
  const allowed = new Set(getUnlockedPhotos(state).flatMap(photo => [photoSrc(photo), thumbnailSrc(photo)]));
  view.journal.open({ tab: 'photos', buildingId: 'canteen' });
  assert.equal(view.dialog.open, true);
  assert.match(view.dialog.querySelector('.photo-album__title').textContent, /先去食堂/);
  assert.ok(view.photoSources().length > 0);
  assert.ok(view.photoSources().every(src => allowed.has(src)));
  view.control('show-all').click();
  assert.ok(view.photoSources().every(src => allowed.has(src)));
  view.loads.length = 0;
  view.journal.open({ tab: 'photos', buildingId: 'birthday' });
  assert.equal(view.photoSources().length, 0);
  assert.equal(view.loads.length, 0, 'a requested locked building must not load any preview or thumbnail');
});

test('the birthday photos tab shows all permitted photos while unread illustrations remain sealed', t => {
  const state = birthdayState(), view = journalFixture(t, state);
  const expected = new Set(getUnlockedPhotos(state).map(thumbnailSrc));
  expected.add('/assets/memories/01.jpg');
  view.journal.open({ tab: 'photos' });
  assert.deepEqual(new Set(view.photoSources()), expected);
  assert.equal(view.sources().length, 0, 'the hidden illustration panel is not populated');
  assert.equal(view.loads.some(src => src.includes('/game-portraits/')), false);
  view.tab('all').click();
  assert.equal(view.photoSources().length, 0, 'leaving photos clears its image sources');
  assert.equal(view.card('honor').dataset.revealed, 'false');
  assert.equal(view.sources().some(src => src.includes('/game-portraits/')), false);
});

test('photo categories, arrows and thumbnails notify only when a different photo appears', t => {
  let changes = 0;
  const view = journalFixture(t, birthdayState(), { onPhotoChange: () => changes++ });
  view.journal.open({ tab: 'photos' });
  assert.equal(changes, 0);
  view.control('previous').click();
  assert.equal(changes, 0);
  view.control('next').click();
  assert.equal(changes, 1);
  view.control('previous').click();
  assert.equal(changes, 2);
  view.control('thumb-photo-03').click();
  assert.equal(changes, 3);
  view.control('thumb-photo-03').click();
  assert.equal(changes, 3);
  view.control('filter-campus').click();
  const campusIds = new Set(PHOTOS.filter(photo => photo.category === 'campus').map(photo => `thumb-${photo.id}`));
  assert.ok(view.nodes().filter(node => node.dataset.albumControl?.startsWith('thumb-')).every(node => campusIds.has(node.dataset.albumControl)));
  assert.equal(changes, 4);
  const stale = view.control('next');
  view.journal.close(); stale.click();
  assert.equal(changes, 4);
});

test('refresh, native close and reset remove photos that no longer belong to the current journey', t => {
  const view = journalFixture(t, birthdayState());
  view.journal.open({ tab: 'photos', buildingId: 'birthday' });
  const birthdayIds = new Set(getBuildingPhotoIds('birthday'));
  assert.ok(view.photoSources().length > 0);
  assert.ok(view.nodes().some(node => birthdayIds.has(node.dataset.albumControl?.slice(6))));
  view.setState(createInitialState()); view.loads.length = 0;
  view.journal.refresh();
  assert.equal(view.photoSources().length, 0);
  assert.equal(view.loads.length, 0);
  view.setState(birthdayState()); view.journal.open({ tab: 'photos' });
  view.dialog.close();
  assert.equal(view.photoSources().length, 0);
  view.journal.open({ tab: 'photos' }); view.journal.reset();
  assert.equal(view.photoSources().length, 0);
  view.setState(createInitialState()); view.loads.length = 0; view.journal.open({ tab: 'photos' });
  assert.equal(view.photoSources().length, 0);
  assert.equal(view.loads.length, 0);
});

test('manual reveals notify once per newly revealed page and remember never invokes the callback', t => {
  const state = birthdayState(), revealed = [], view = journalFixture(t, state, { onReveal: tile => revealed.push(tile.id) });
  view.journal.remember(memory('dorm'));
  assert.deepEqual(revealed, []);
  view.journal.open();
  const staleArt = view.card('honor').querySelector('.keepsake-art');
  const staleRead = view.card('honor').querySelector('.keepsake-read');
  staleArt.click(); staleArt.click(); staleRead.click();
  assert.deepEqual(revealed, ['honor']);
  const expected = getJournalPages(state, 'all', ['dorm', 'honor']).filter(page => !page.revealed).map(page => page.tile.id);
  view.dialog.querySelector('.journal-reveal-all').click();
  assert.deepEqual(revealed, ['honor', ...expected]);
  assert.equal(new Set(revealed).size, revealed.length);
  assert.equal(revealed.includes('school'), false);
  assert.equal(revealed.includes('canteen'), false);
  assert.equal(revealed.includes('dorm'), false);
  assert.equal(revealed.length, MEMORY_TILES.length - 3);
  view.dialog.querySelector('.journal-reveal-all').emit('click');
  assert.equal(revealed.length, MEMORY_TILES.length - 3);
});

test('stale reveal buttons recheck the current journey before revealing or notifying', t => {
  const revealed = [], view = journalFixture(t, birthdayState(), { onReveal: tile => revealed.push(tile.id) });
  view.journal.open();
  const stale = view.card('honor').querySelector('.keepsake-art');
  view.setState(createInitialState()); view.journal.reset();
  stale.click();
  view.dialog.querySelector('.journal-reveal-all').emit('click');
  assert.deepEqual(revealed, []);
  view.journal.open();
  assert.equal(view.sources().some(src => src.includes('/game-portraits/')), false);
});
