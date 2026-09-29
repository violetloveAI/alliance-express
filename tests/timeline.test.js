import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, move, MAX_STEPS, MEMORY_TILES, VILLAGE_TILES,
  getTile, getNeighbors, getVillageVisits, tileKey, canInspectMemory, isInside,
} from '../src/exploration.js';
import { getTimelineEntries, createTimeline } from '../src/timeline.js';
import { getBuildingPhotoStatus } from '../src/photo-access.js';

const memory = id => MEMORY_TILES.find(tile => tile.id === id);
const village = id => VILLAGE_TILES.find(tile => tile.id === id);
const reveal = (memoryId, step) => ({ id: `reveal:${memoryId}`, memoryId, step });
const fresh = () => ({ ...createInitialState(), villageSeed: 17 });

function walk(positions, initial = fresh()) {
  return positions.reduce((state, position) => {
    const next = move(state, position);
    assert.equal(next.steps, state.steps + 1, `test route must move to ${tileKey(position)}`);
    return next;
  }, initial);
}

function shuttle(steps) {
  return walk(Array.from({ length: steps }, (_, index) => ({ q: (index + 1) % 2, r: 0 })));
}

// Route fixtures address landmarks by ID so layout changes do not erase coverage.
function route(from, to) {
  const queue = [[{ q: from.q, r: from.r }]], seen = new Set([tileKey(from)]);
  for (const path of queue) {
    const last = path.at(-1);
    if (tileKey(last) === tileKey(to)) return path.slice(1);
    for (const point of getNeighbors(last)) {
      if (!seen.has(tileKey(point))) { seen.add(tileKey(point)); queue.push([...path, point]); }
    }
  }
  assert.fail(`No route to ${tileKey(to)}`);
}

function arrive(tile, state = fresh()) { return walk(route(state.position, tile), state); }
function birthdayAt(tile) {
  const path = route({ q: 0, r: 0 }, tile);
  const padding = 25 - path.length;
  let state = shuttle(padding % 2 ? padding - 3 : padding);
  if (padding % 2) state = walk([{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: 0 }], state);
  return walk(path, state);
}
function rewardJourney(seed = 17) {
  const state = arrive(VILLAGE_TILES.find(tile => tile.effect === 'memory-cache'), { ...fresh(), villageSeed: seed });
  const reward = getVillageVisits(state).find(visit => visit.step === state.steps);
  assert.ok(reward?.unlockedIds.length > 0, 'fixture needs an actual village reward');
  return { state, reward, target: memory(reward.unlockedIds[0]) };
}
function emptyTile() {
  for (let q = -5; q <= 5; q++) for (let r = -5; r <= 5; r++) {
    if (!isInside(q, r)) continue;
    const tile = getTile({ q, r });
    if (tile && !tile.isMemory && !tile.isVillage && route({ q: 0, r: 0 }, tile).length < 6) return tile;
  }
  assert.fail('The island should contain ordinary scenery');
}

// Catches counting collections, rewards or previews as movement.
test('each real move creates one base record with an independent chronological position', () => {
  assert.deepEqual(getTimelineEntries(fresh()), []);
  const state = shuttle(4), before = structuredClone(state);
  const entries = getTimelineEntries(state);
  assert.deepEqual(entries.map(entry => [entry.id, entry.step]), [['move:1', 1], ['move:2', 2], ['move:3', 3], ['move:4', 4]]);
  assert.deepEqual(entries.map(entry => entry.position), [{ q: 1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 0 }]);
  assert.ok(entries.every(entry => entry.recordIndex === 1 && entry.recordCount === 1));
  entries[0].position.q = 5;
  assert.deepEqual(state, before);
});

test('revisits remain separate turns and have a different short note', () => {
  const entries = getTimelineEntries(shuttle(7));
  assert.equal(entries[0].kind, 'memory');
  assert.equal(entries[2].kind, 'revisit');
  assert.equal(entries[2].tile.id, 'canteen');
  assert.notEqual(entries[0].text, entries[2].text);
  assert.notEqual(entries[2].text, entries[4].text);
  assert.ok(entries.every(entry => entry.text.length > 5 && entry.text.length < 100));
});

test('ordinary scenery and its revisits never borrow memory artwork', () => {
  const state = arrive(emptyTile());
  const first = getTimelineEntries(state).at(-1);
  const returned = walk([state.trail.at(-2), state.position], state);
  const revisit = getTimelineEntries(returned).at(-1);
  assert.equal(first.kind, 'scenery');
  assert.equal(revisit.kind, 'revisit');
  assert.equal(first.tile, undefined);
  assert.equal(revisit.tile, undefined);
  assert.ok(first.text.length > 5);
  assert.notEqual(first.text, revisit.text);
});

test('the birthday and its colocated memory are separate fragments of the same turn', () => {
  const entries = getTimelineEntries(shuttle(29));
  const birthday = entries.filter(entry => entry.step === 25);
  assert.equal(entries.length, 30);
  assert.deepEqual(birthday.map(entry => [entry.id, entry.kind, entry.recordIndex, entry.recordCount]), [
    ['move:25', 'birthday', 1, 2], ['arrival:25', 'revisit', 2, 2],
  ]);
  assert.equal(birthday[0].tile, undefined);
  assert.equal(birthday[1].tile.id, 'canteen');
  assert.deepEqual([...new Set(entries.filter(entry => entry.tile).map(entry => entry.tile.id))].sort(), ['canteen', 'school']);
  assert.equal(entries.filter(entry => entry.id.startsWith('move:')).length, 29);
});

test('a village reward belongs to its arrival and is never repeated on a revisit', () => {
  const { state, reward } = rewardJourney();
  const entries = getTimelineEntries(walk([state.trail.at(-2), state.position], state));
  const first = entries.find(entry => entry.step === state.steps);
  assert.equal(first.kind, 'village');
  assert.equal(first.village.villageId, reward.villageId);
  assert.equal(first.tile, undefined);
  assert.equal(entries.at(-1).kind, 'revisit');
  assert.equal(entries.at(-1).village, undefined);
  assert.equal(entries.at(-1).villageTile.id, reward.villageId);
  assert.equal(entries.filter(entry => entry.village?.villageId === reward.villageId).length, 1);
});

test('unopened village rewards and their photos never create memory fragments', () => {
  const { state, reward } = rewardJourney();
  const entries = getTimelineEntries(state, [{ id: `photo:${reward.unlockedIds[0]}`, memoryId: reward.unlockedIds[0], step: state.steps }]);
  assert.ok(reward.unlockedIds.every(id => !entries.some(entry => entry.tile?.id === id)));
  assert.equal(entries.length, state.steps);
});

test('a photo-bearing village gift stays absent from the timeline until its memory is explicitly revealed', () => {
  let fixture;
  for (let seed = 1; seed <= 40 && !fixture; seed++) {
    const { state, reward } = rewardJourney(seed);
    const memoryId = reward.unlockedIds.find(id => getBuildingPhotoStatus(state, id).total > 0);
    if (memoryId) fixture = { state, memoryId };
  }
  assert.ok(fixture, 'fixture needs a genuine village gift that includes photos');
  const { state, memoryId } = fixture;
  const photos = getBuildingPhotoStatus(state, memoryId);
  assert.equal(photos.unlocked, photos.total);
  assert.equal(getTimelineEntries(state).some(entry => entry.tile?.id === memoryId), false);
  const entries = getTimelineEntries(state, [reveal(memoryId, state.steps)]);
  assert.equal(entries.filter(entry => entry.tile?.id === memoryId).length, 1);
  assert.equal(entries.at(-1).kind, 'reveal');
});

test('a manual reward reveal adds a second fragment after movement without counting another turn', () => {
  const { state, target } = rewardJourney(), before = structuredClone(state);
  const entries = getTimelineEntries(state, [reveal(target.id, state.steps)]);
  const fragments = entries.filter(entry => entry.step === state.steps);
  assert.equal(entries.length, state.steps + 1);
  assert.deepEqual(fragments.map(entry => [entry.id, entry.kind, entry.recordIndex, entry.recordCount]), [
    [`move:${state.steps}`, 'village', 1, 2], [`reveal:${target.id}`, 'reveal', 2, 2],
  ]);
  assert.deepEqual(fragments[1].position, { q: target.q, r: target.r });
  assert.equal(fragments[1].tile.id, target.id);
  assert.deepEqual(state, before);
});

test('a village arrival on the birthday has its own card after the cake', () => {
  const target = village('village-meadow'), state = birthdayAt(target);
  const fragments = getTimelineEntries(state).filter(entry => entry.step === 25);
  assert.deepEqual(fragments.map(entry => entry.kind), ['birthday', 'village']);
  assert.equal(fragments[1].village.villageId, target.id);
  assert.equal(fragments[1].village.step, 25);
  assert.ok(fragments.every(entry => entry.recordCount === 2));
});

test('discoveries are sorted by turn, keep input order within a turn, and deduplicate a memory', () => {
  const state = shuttle(28), first = memory('honor'), second = memory('hainan');
  const events = [reveal(first.id, 27), reveal(second.id, 26), reveal(first.id, 26), reveal(first.id, 26)];
  const before = structuredClone(events);
  const entries = getTimelineEntries(state, events);
  const fragments = entries.filter(entry => entry.step === 26);
  assert.deepEqual(fragments.map(entry => entry.id), ['move:26', `reveal:${second.id}`, `reveal:${first.id}`]);
  assert.deepEqual(fragments.map(entry => entry.recordIndex), [1, 2, 3]);
  assert.ok(fragments.every(entry => entry.recordCount === 3));
  assert.equal(entries.filter(entry => entry.id === `reveal:${first.id}`).length, 1);
  assert.ok(entries.every((entry, index) => !index || entries[index - 1].step <= entry.step));
  assert.deepEqual(events, before);
});

test('reveal eligibility is checked at the recorded turn, not against current birthday access', () => {
  const state = shuttle(26), target = memory('honor');
  assert.equal(canInspectMemory(state, target), true);
  const entries = getTimelineEntries(state, [reveal(target.id, 24), reveal(target.id, 25)]);
  assert.equal(entries.filter(entry => entry.kind === 'reveal').length, 1);
  assert.equal(entries.find(entry => entry.kind === 'reveal').step, 25);
});

test('a village gift is accepted only after that village was actually reached', () => {
  const { state, target } = rewardJourney();
  const entries = getTimelineEntries(state, [reveal(target.id, state.steps - 1), reveal(target.id, state.steps)]);
  assert.equal(entries.filter(entry => entry.kind === 'reveal').length, 1);
  assert.equal(entries.find(entry => entry.kind === 'reveal').step, state.steps);
});

test('malformed, future, unknown and already visited reveal events cannot create fragments', () => {
  const state = shuttle(26), target = memory('honor');
  const badEvents = [
    null, {}, reveal('unknown', 26), reveal(target.id, 27), reveal(target.id, -1), reveal(target.id, 25.5),
    reveal('school', 0), reveal('canteen', 1), reveal('canteen', 26),
    { ...reveal(target.id, 25), id: 'reveal:other' }, { ...reveal(target.id, 25), step: '25' },
  ];
  assert.ok(getTimelineEntries(state, badEvents).every(entry => entry.kind !== 'reveal'));
  assert.ok(getTimelineEntries(state, null).every(entry => entry.kind !== 'reveal'));
  assert.ok(getTimelineEntries(fresh(), [reveal(target.id, 25)]).length === 0);
});

test('a real remote reveal remains recorded after physically arriving at that place later', () => {
  const { state, target } = rewardJourney();
  const later = arrive(target, state);
  const entries = getTimelineEntries(later, [reveal(target.id, state.steps), reveal(target.id, later.steps)]);
  assert.equal(entries.filter(entry => entry.id === `reveal:${target.id}`).length, 1);
  assert.equal(entries.find(entry => entry.id === `reveal:${target.id}`).step, state.steps);
  assert.equal(entries.at(-1).tile.id, target.id);
  assert.notEqual(entries.at(-1).kind, 'reveal');
});

test('untrusted trails cannot fabricate movements or use forged reward payloads', () => {
  const state = shuttle(2);
  for (const invalid of [
    null, undefined, {}, { ...state, version: 1 }, { ...state, steps: 3 },
    { ...state, position: { q: 5, r: 0 } },
    { ...state, trail: [{ q: 0, r: 0 }, { q: 5, r: 0 }, { q: 0, r: 0 }] },
  ]) assert.deepEqual(getTimelineEntries(invalid, [reveal('honor', 1)]), []);
  const fakeMetadata = { ...state, visited: ['5,0'], birthdayAt: { q: 5, r: 0 }, villageVisits: [{ step: 1, unlockedIds: ['honor'] }] };
  const entries = getTimelineEntries(fakeMetadata, [reveal('honor', 1)]);
  assert.deepEqual(entries.map(entry => entry.tile.id), ['canteen', 'school']);
});

test('the exceptional birthday landing beyond the shore remains one card', () => {
  const state = walk([
    { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 },
    { q: 5, r: 0 }, { q: 5, r: -1 }, { q: 6, r: -1 }, { q: 5, r: -1 },
  ], shuttle(18));
  const entries = getTimelineEntries(state);
  assert.equal(entries.length, 26);
  assert.equal(entries[24].kind, 'birthday');
  assert.deepEqual(entries[24].position, { q: 6, r: -1 });
  assert.equal(entries[24].recordCount, 1);
});

test('the move limit remains readable even when fragment count exceeds it', () => {
  const trail = Array.from({ length: MAX_STEPS + 1 }, (_, step) => ({ q: step % 2, r: 0 }));
  const entries = getTimelineEntries({ version: 2, steps: MAX_STEPS, position: { q: 0, r: 0 }, trail }, [reveal('honor', MAX_STEPS)]);
  assert.equal(entries.filter(entry => entry.id.startsWith('move:')).length, MAX_STEPS);
  assert.equal(entries.length, MAX_STEPS + 2);
  assert.equal(entries.at(-1).step, MAX_STEPS);
});

function documentFixture(t) {
  const names = ['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const descendants = root => root.children.flatMap(child => [child, ...descendants(child)]);
  class Element {
    constructor(tag) {
      this.tagName = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.listeners = new Map();
      this.className = ''; this.textContent = ''; this.scrollLeft = 0; this.scrollWidth = 900; this.clientWidth = 300;
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: name => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
        toggle: (name, enabled) => { this.className = this.className.split(/\s+/).filter(value => value !== name).concat(enabled ? [name] : []).join(' '); },
      };
    }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    setAttribute(name, value) { this.attrs[name] = String(value); if (name === 'class') this.className = value; }
    addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]); }
    showModal() { this.open = true; }
    close() { this.open = false; for (const callback of this.listeners.get('close') ?? []) callback(); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    querySelectorAll(selector) {
      return descendants(this).filter(node => selector.startsWith('.') ? node.classList.contains(selector.slice(1))
        : selector === 'dialog[open]' ? node.tagName === 'dialog' && node.open : node.tagName === selector);
    }
    set innerHTML(markup) {
      this.replaceChildren();
      const stack = [this];
      for (const match of markup.matchAll(/<(\/)?([\w-]+)([^>]*)>/g)) {
        if (match[1]) { if (stack.at(-1)?.tagName === match[2]) stack.pop(); continue; }
        const node = new Element(match[2]);
        for (const attribute of match[3].matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(attribute[1], attribute[2]);
        stack.at(-1).append(node);
        if (!match[3].endsWith('/') && !['img', 'input', 'br', 'hr'].includes(match[2])) stack.push(node);
      }
    }
  }
  const body = new Element('body');
  globalThis.document = { body, createElement: tag => new Element(tag), createElementNS: (_namespace, tag) => new Element(tag), querySelector: selector => body.querySelector(selector) };
  globalThis.window = { addEventListener() {}, matchMedia: () => ({ matches: true }) };
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  t.after(() => names.forEach((name, index) => previous[index] ? Object.defineProperty(globalThis, name, previous[index]) : delete globalThis[name]));
  return body;
}

test('the rendered timeline keeps turn and fragment counts distinct and requests only explicitly revealed art', t => {
  const body = documentFixture(t), { state, target } = rewardJourney();
  let discoveries = [], opened = 0;
  const timeline = createTimeline({ getState: () => state, getDiscoveries: () => discoveries, asset: file => `/assets/${file}`, onOpen: () => { opened++; } });
  timeline.open();
  const dialog = body.querySelector('dialog');
  const track = dialog.querySelector('.timeline-track');
  assert.equal(track.children.length, state.steps);
  assert.equal(track.children.some(card => card.dataset.recordId === `reveal:${target.id}`), false);
  timeline.open();
  assert.equal(opened, 1, 'an already open timeline is not a new read');
  timeline.close();
  discoveries = [reveal(target.id, state.steps)];
  timeline.open();
  assert.equal(opened, 2);
  assert.equal(track.children.length, state.steps + 1);
  assert.equal(dialog.querySelector('.timeline-count').textContent, `${state.steps} 回合`);
  assert.equal(dialog.querySelector('.timeline-record-count').textContent, `${state.steps + 1} 个片段`);
  const card = track.children.at(-1);
  assert.equal(card.dataset.recordId, `reveal:${target.id}`);
  assert.ok(card.querySelector('img').src.startsWith('/assets/'));
  assert.match(card.querySelector('.timeline-turn-number').textContent, /片段 2/);
});

test('every ordinary scenery card, including a revisit, uses the shared passing-train illustration', t => {
  const body = documentFixture(t), first = arrive(emptyTile());
  const state = walk([first.trail.at(-2), first.position], first);
  const timeline = createTimeline({ getState: () => state, asset: file => `/assets/${file}` });
  timeline.open();
  const track = body.querySelector('.timeline-track');
  const passing = track.querySelectorAll('.timeline-art--passing');
  assert.ok(passing.length >= 2);
  assert.ok(passing.every(art => art.querySelector('img').src === '/assets/illustrations/passing-train-v10.webp'));
  assert.equal(track.children.at(-1).querySelector('img').src, '/assets/illustrations/passing-train-v10.webp');
});
