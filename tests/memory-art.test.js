import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createMemoryArt } from '../src/memory-art.js';
import { getBuildingPhotoStatus } from '../src/photo-access.js';
import { installJournalDOM, journalFixture, descendants, walkTo, pathTo, birthdayState } from './journal-fixture.js';
import { MEMORY_TILES, createInitialState, move, restoreState, serializeState, getArrivalMemory, canInspectMemory, getVillageVisits, VILLAGE_TILES } from '../src/exploration.js';

const tile = id => MEMORY_TILES.find(item => item.id === id);
const asset = file => `/assets/${file}`;
const documentFixture = t => installJournalDOM(t).Element;

test('every memory cover uses an existing illustration or character portrait, never an album photograph', t => {
  documentFixture(t);
  for (const memory of MEMORY_TILES) {
    for (const compact of [false, true]) {
      const art = createMemoryArt(memory, asset, { compact });
      const images = art.tagName === 'img' ? [art] : descendants(art).filter(node => node.tagName === 'img');
      assert.ok(images.length, `${memory.id} needs cover art`);
      for (const image of images) {
        assert.match(image.src, /^\/assets\/(illustrations|game-portraits)\//, `${memory.id} must keep real photos in the photo tab`);
        assert.ok(existsSync(new URL(`../public${image.src}`, import.meta.url)), `${memory.id} artwork must exist`);
      }
    }
  }
});

test('a collected fitness page shows its drawn exercise scene and retains the separate photo count', t => {
  const state = walkTo(createInitialState(), tile('fitness'));
  const view = journalFixture(t, state, { getPhotoStatus: getBuildingPhotoStatus });
  view.journal.open();
  assert.ok(view.sources().includes('/assets/illustrations/fitness-v11.webp'));
  assert.equal(view.sources().includes('/assets/memories/27.jpg'), false);
  assert.match(view.card('fitness').querySelector('.keepsake-note').textContent, /1 张照片/);
  assert.equal(view.photoSources().length, 0);
  view.journal.open({ tab: 'photos', buildingId: 'fitness' });
  assert.ok(view.photoSources().includes('/assets/memories/27.jpg'));
});

for (const [id, expected] of [
  ['honor', [['貂蝉', 'Violet'], ['程咬金', 'Water Sheep']]],
  ['alliance', [['秦始皇', 'Violet'], ['安比奥里克斯', 'Water Sheep']]],
]) {
  test(`${id} uses both requested game characters with their player labels in detail and collection art`, t => {
    documentFixture(t);
    assert.deepEqual(tile(id).heroPortraits.map(p => [p.character, p.player]), expected);
    for (const compact of [false, true]) {
      const art = createMemoryArt(tile(id), asset, { compact });
      const images = descendants(art).filter(node => node.tagName === 'img');
      assert.equal(images.length, 2);
      assert.deepEqual(images.map(image => image.alt), expected.map(([character, player]) => `${character}，代表 ${player}`));
      assert.ok(images.every(image => image.src.startsWith('/assets/game-portraits/')));
      assert.ok(images.every(image => compact ? image.loading === 'lazy' : image.loading === undefined));
    }
  });
}

test('long-call art replaces the Hainan illustration and survives a saved visit', t => {
  documentFixture(t);
  const call = tile('hainan');
  assert.match(call.description, /遇到困难.*语音聊很久/);
  assert.equal(createMemoryArt(call, asset).src, '/assets/illustrations/long-call-v5.webp');
  assert.equal(call.asset, 'long-call-landmark-v5.webp');
  const state = walkTo(createInitialState(), call);
  const restored = restoreState(serializeState(state));
  assert.equal(restored.steps, state.steps);
  assert.equal(canInspectMemory(restored, call), true);
});

test('the new Honor of Kings tile emits one arrival and remains collected in version-two saves', () => {
  const route = pathTo(createInitialState().position, tile('honor'));
  const before = route.slice(0, -1).reduce((state, point) => move(state, point), createInitialState());
  assert.equal(canInspectMemory(before, tile('honor')), false);
  const arrived = move(before, tile('honor'));
  assert.equal(getArrivalMemory(before, arrived).id, 'honor');
  const restored = restoreState(serializeState(arrived));
  assert.equal(restored.version, 2);
  assert.equal(canInspectMemory(restored, tile('honor')), true);
  const returned = move(restored, before.position);
  assert.equal(getArrivalMemory(returned, move(returned, tile('honor'))), null);
});

function renderJournal(t, state) {
  const view = journalFixture(t, state);
  view.journal.open();
  return view;
}

test('a visible but unvisited hero landmark has no portrait URLs in the collection', t => {
  const route = pathTo(createInitialState().position, tile('honor'));
  const state = route.slice(0, -1).reduce((current, point) => move(current, point), createInitialState());
  const sources = renderJournal(t, state).sources();
  assert.ok(sources.includes('/assets/illustrations/school.webp'));
  assert.equal(canInspectMemory(state, tile('honor')), false);
  for (const portrait of tile('honor').heroPortraits) assert.equal(sources.includes(asset(portrait.file)), false);
});

test('a first visit puts both hero portraits into the collection', t => {
  const state = walkTo(createInitialState(), tile('honor'));
  const sources = renderJournal(t, state).sources();
  assert.ok(sources.includes('/assets/game-portraits/honor-diaochan-cozy-v6.webp'));
  assert.ok(sources.includes('/assets/game-portraits/honor-chengyaojin-cozy-v6.webp'));
  assert.equal(canInspectMemory(state, tile('honor')), true);
});

test('birthday portraits stay sealed until a user reveals one page or chooses reveal all', t => {
  const state = birthdayState();
  const before = structuredClone(state);
  const view = renderJournal(t, state);
  assert.equal(view.sources().some(src => src.includes('game-portraits/')), false, 'eligible pages must not request their image URLs before revealing');
  assert.equal(view.card('honor').dataset.revealed, 'false');
  view.card('honor').querySelector('.keepsake-art').click();
  assert.equal(view.card('honor').dataset.revealed, 'true');
  assert.equal(view.card('alliance').dataset.revealed, 'false');
  assert.ok(view.sources().includes(asset('game-portraits/honor-diaochan-cozy-v6.webp')));
  assert.ok(view.sources().includes(asset('game-portraits/honor-chengyaojin-cozy-v6.webp')));
  assert.equal(view.sources().some(src => src.includes('/civ-')), false);
  view.dialog.querySelector('.journal-reveal-all').click();
  const sources = view.sources();
  for (const memory of MEMORY_TILES.filter(memory => memory.heroPortraits)) {
    for (const portrait of memory.heroPortraits) assert.ok(sources.includes(asset(portrait.file)), portrait.file);
  }
  assert.deepEqual(state, before);
  assert.ok(!state.visited.includes(`${tile('honor').q},${tile('honor').r}`));
  assert.equal(view.dialog.querySelector('.journal-reveal-all').disabled, true);
});

test('village gifts appear as eligible sealed pages and a click reveals only the chosen gift', t => {
  let state = { ...createInitialState(), villageSeed: 17 };
  state = walkTo(state, VILLAGE_TILES.find(village => village.id === 'village-meadow'));
  const gift = getVillageVisits(state)[0].unlockedIds[0], before = structuredClone(state);
  const view = renderJournal(t, state);
  assert.equal(view.card(gift).dataset.revealed, 'false');
  assert.equal(descendants(view.card(gift)).some(node => node.tagName === 'img'), false);
  assert.equal(view.dialog.querySelector('.journal-reveal-bar').hidden, true);
  view.dialog.querySelector('.journal-reveal-all').click();
  assert.equal(view.card(gift).dataset.revealed, 'false', 'even a stale all-reveal click is gated before 25 steps');
  view.card(gift).querySelector('.keepsake-read').click();
  assert.equal(view.card(gift).dataset.revealed, 'true');
  view.journal.open();
  assert.equal(view.card(gift).dataset.revealed, 'true', 'reopening the same journal keeps a revealed gift');
  assert.deepEqual(state, before);
});

test('reset removes every manual reveal before the next journey reaches its birthday', t => {
  const view = renderJournal(t, birthdayState());
  view.dialog.querySelector('.journal-reveal-all').click();
  assert.equal(view.card('honor').dataset.revealed, 'true');
  view.journal.reset();
  view.setState(createInitialState()); view.journal.open();
  assert.equal(view.sources().some(src => src.includes('game-portraits/')), false);
  view.setState(birthdayState()); view.journal.open();
  assert.equal(view.card('honor').dataset.revealed, 'false');
  assert.equal(view.card('alliance').dataset.revealed, 'false');
  assert.equal(view.sources().some(src => src.includes('game-portraits/')), false);
  assert.equal(view.dialog.querySelector('.journal-reveal-all').disabled, false);
});
