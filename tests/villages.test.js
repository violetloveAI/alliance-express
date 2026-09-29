import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/exploration.js';
import { getBuildingPhotoIds, getUnlockedPhotos, isPhotoUnlocked } from '../src/photo-access.js';
import { routeTo } from './helpers/exploration.js';

const at = (q, r) => ({ q, r });
const memory = id => api.MEMORY_TILES.find(tile => tile.id === id);
const distance = (a, b) => Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));
function walk(points, seed = 17) {
  let state = { ...api.createInitialState(), villageSeed: seed };
  for (const point of points) state = api.move(state, point);
  return state;
}
const meadow = seed => walk([at(0, 1), at(0, 2)], seed);

test('five independent villages preserve every memory and occupy distinct reachable cells', () => {
  assert.equal(api.VILLAGE_TILES?.length, 5);
  assert.equal(api.MEMORY_TILES.length, 33);
  const occupied = new Set(api.MEMORY_TILES.map(api.tileKey));
  const villages = new Set();
  for (const village of api.VILLAGE_TILES) {
    assert.equal(village.isVillage, true);
    assert.equal(village.isMemory, false);
    assert.equal(api.getTile(village).id, village.id);
    assert.equal(api.isInside(village.q, village.r), true);
    assert.equal(occupied.has(api.tileKey(village)), false);
    assert.equal(villages.has(api.tileKey(village)), false);
    villages.add(api.tileKey(village));
  }
  assert.ok(api.VILLAGE_TILES.some(tile => distance(tile, at(0, 0)) <= 2));
  assert.ok(api.VILLAGE_TILES.some(tile => tile.q < 0));
  assert.ok(api.VILLAGE_TILES.some(tile => tile.q > 0));
});

test('the first village unlocks one or two unvisited memories without adding journey steps', () => {
  assert.equal(typeof api.getVillageVisits, 'function');
  const before = walk([at(0, 1)]), after = api.move(before, at(0, 2));
  const reward = api.getVillageArrival(before, after);
  assert.equal(reward.villageId, 'village-meadow');
  assert.equal(reward.step, 2);
  assert.equal(reward.effect, 'memory-cache');
  assert.ok(reward.title && reward.description);
  assert.ok(reward.unlockedIds.length >= 1 && reward.unlockedIds.length <= 2);
  assert.equal(new Set(reward.unlockedIds).size, reward.unlockedIds.length);
  assert.equal(after.steps, 2);
  assert.deepEqual(after.trail, [at(0, 0), at(0, 1), at(0, 2)]);
  assert.deepEqual(after.visited, ['0,0', '0,1', '0,2']);
  assert.equal(after.birthdayAt, null);
  assert.equal(api.getArrivalMemory(before, after), null);
  for (const id of reward.unlockedIds) {
    const tile = memory(id);
    assert.ok(tile);
    assert.equal(before.visited.includes(api.tileKey(tile)), false);
    assert.equal(api.canInspectMemory(before, tile), false);
    assert.equal(api.canInspectMemory(after, tile), true);
    assert.ok(api.getVisibleKeys(after).includes(api.tileKey(tile)));
  }
});

test('village gifts survive restore and repeated queries without re-rolling or duplicate claims', () => {
  assert.equal(typeof api.getVillageVisits, 'function');
  const first = meadow(41), expected = api.getVillageVisits(first);
  const restored = api.restoreState(api.serializeState(first));
  assert.equal(restored.villageSeed, 41);
  assert.deepEqual(api.getVillageVisits(restored), expected);
  assert.deepEqual(api.getVillageVisits(first), expected);
  const returned = api.move(first, at(0, 1)), revisit = api.move(returned, at(0, 2));
  assert.equal(api.getVillageArrival(returned, revisit), null);
  assert.deepEqual(api.getVillageVisits(revisit), expected);
  assert.equal(api.getVillageArrival(first, first), null);
  assert.equal(api.getVillageArrival(first, meadow(42)), null);
  expected[0].unlockedIds.push('fake');
  expected[0].revealedKeys.push('99,99');
  assert.equal(api.getVillageVisits(first)[0].unlockedIds.includes('fake'), false);
  assert.equal(api.getVisibleKeys(first).includes('99,99'), false);
});

test('different expedition seeds vary gifts while each new state stores its seed', () => {
  assert.equal(typeof api.getVillageVisits, 'function');
  const seeds = new Set(Array.from({ length: 8 }, () => api.createInitialState().villageSeed));
  assert.ok(seeds.size > 1);
  for (const seed of seeds) assert.ok(Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff);
  const outcomes = new Set(Array.from({ length: 16 }, (_, index) => JSON.stringify(api.getVillageVisits(meadow(index + 1))[0].unlockedIds)));
  assert.ok(outcomes.size > 1);
});

test('scouting reveals the second ring permanently without unlocking its buildings', () => {
  assert.equal(typeof api.getVillageVisits, 'function');
  const before = walk([at(1, 0), at(2, 0)]), after = api.move(before, at(3, 0));
  const reward = api.getVillageArrival(before, after);
  assert.equal(reward.effect, 'scout-ring');
  assert.deepEqual(reward.unlockedIds, []);
  assert.equal(api.getVisibleKeys(before).includes('4,-2'), false);
  assert.ok(reward.revealedKeys.includes('4,-2'));
  assert.ok(api.getVisibleKeys(after).includes('4,-2'));
  assert.equal(api.canInspectMemory(after, at(4, -2)), false);
  assert.ok(reward.revealedKeys.every(key => {
    const [q, r] = key.split(',').map(Number);
    return api.isInside(q, r) && distance(at(q, r), after.position) === 2;
  }));
  assert.ok(api.getVisibleKeys(api.move(after, at(2, 0))).includes('4,-2'));
});

test('a guide reveals a continuous shortest path to the nearest locked memory and unlocks it', () => {
  assert.equal(typeof api.getVillageVisits, 'function');
  const route = routeTo(api.createInitialState(), 'village-river');
  const before = walk(route.slice(0, -1)), after = api.move(before, route.at(-1));
  const reward = api.getVillageArrival(before, after);
  assert.equal(reward.effect, 'memory-path');
  assert.equal(reward.unlockedIds.length, 1);
  const target = memory(reward.unlockedIds[0]);
  const nearestDistance = Math.min(...api.MEMORY_TILES.filter(tile => !api.canInspectMemory(before, tile)).map(tile => distance(after.position, tile)));
  assert.equal(distance(after.position, target), nearestDistance);
  assert.equal(reward.revealedKeys[0], api.tileKey(after.position));
  assert.equal(reward.revealedKeys.at(-1), api.tileKey(target));
  assert.equal(reward.revealedKeys.length, nearestDistance + 1);
  const path = reward.revealedKeys.map(key => { const [q, r] = key.split(',').map(Number); return at(q, r); });
  for (let index = 1; index < path.length; index++) assert.equal(distance(path[index - 1], path[index]), 1);
  assert.equal(api.canInspectMemory(before, target), false);
  assert.equal(api.canInspectMemory(after, target), true);
  for (const key of reward.revealedKeys) assert.ok(api.getVisibleKeys(after).includes(key));
});

test('reward unlocked building photos pass every access gate before the birthday', () => {
  assert.equal(typeof api.getVillageVisits, 'function');
  let checkedPhotos = 0;
  for (let seed = 1; seed <= 16; seed += 1) {
    const state = meadow(seed);
    const unlocked = new Set(getUnlockedPhotos(state).map(photo => photo.id));
    for (const id of api.getVillageVisits(state)[0].unlockedIds) {
      for (const photoId of getBuildingPhotoIds(id)) {
        checkedPhotos += 1;
        assert.ok(unlocked.has(photoId));
        assert.equal(isPhotoUnlocked(state, photoId), true);
      }
    }
    assert.equal(isPhotoUnlocked(state, 'photo-19'), false);
  }
  assert.ok(checkedPhotos > 0, 'the sample must exercise an actual building photo');
});

test('forged unlock fields or invalid trails never grant a village reward or photo access', () => {
  assert.equal(typeof api.getVillageVisits, 'function');
  const initial = { ...api.createInitialState(), unlockedIds: ['canteen'], revealedKeys: ['5,0'], villageVisits: [{ villageId: 'village-meadow', unlockedIds: ['canteen'] }] };
  assert.deepEqual(api.getVillageVisits(initial), []);
  assert.equal(api.canInspectMemory(initial, memory('canteen')), false);
  assert.equal(api.getVisibleKeys(initial).includes('5,0'), false);
  assert.equal(isPhotoUnlocked(initial, getBuildingPhotoIds('canteen')[0]), false);
  const impossible = { ...meadow(7), trail: [at(0, 0), at(4, 0), at(0, 2)] };
  assert.deepEqual(api.getVillageVisits(impossible), []);
  assert.equal(api.getVillageArrival(initial, impossible), null);
  assert.deepEqual(getUnlockedPhotos(impossible), []);
  const reset = api.restoreState(JSON.stringify(impossible));
  assert.equal(reset.steps, 0);
  assert.deepEqual(api.getVillageVisits(reset), []);
});

test('old saves migrate deterministically and strip fabricated reward payloads', () => {
  assert.equal(typeof api.getVillageVisits, 'function');
  const { villageSeed, ...legacy } = meadow(7);
  legacy.unlockedIds = api.MEMORY_TILES.map(tile => tile.id);
  const first = api.restoreState(JSON.stringify(legacy)), second = api.restoreState(JSON.stringify(legacy));
  assert.equal(first.steps, 2);
  assert.equal(first.villageSeed, second.villageSeed);
  assert.deepEqual(api.getVillageVisits(first), api.getVillageVisits(second));
  assert.equal('unlockedIds' in first, false);
  const moved = api.move(first, at(0, 1));
  assert.equal(moved.villageSeed, first.villageSeed);
});

test('birthday and later village arrivals keep the full-map and album rules without empty unlock gifts', () => {
  assert.equal(typeof api.getVillageVisits, 'function');
  let before = api.createInitialState();
  for (let step = 1; step <= 24; step += 1) before = api.move(before, at(step % 2, 0));
  const birthday = api.move(before, at(0, 1));
  const next = api.move(birthday, at(0, 2));
  const reward = api.getVillageArrival(birthday, next);
  assert.equal(reward.effect, 'celebration');
  assert.deepEqual(reward.unlockedIds, []);
  assert.deepEqual(reward.revealedKeys, []);
  assert.equal(next.steps, 26);
  assert.deepEqual(next.birthdayAt, at(0, 1));
  assert.equal(api.getVisibleKeys(next).length, 91);
  assert.equal(isPhotoUnlocked(next, 'photo-19'), true);
  assert.equal(api.MEMORY_TILES.every(tile => api.canInspectMemory(next, tile)), true);
});
