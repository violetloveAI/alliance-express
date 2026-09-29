import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, move, getArrivalMemory, canInspectMemory, MEMORY_TILES } from '../src/exploration.js';
import { getBuildingPhotoStatus, isPhotoUnlocked } from '../src/photo-access.js';
import { routeTo, walkTo } from './helpers/exploration.js';

// Catch missing/overlapping map registrations and photographs assigned to the wrong stop.
test('the four school additions can be visited and collected independently', () => {
  for (const id of ['fitness', 'physics', 'guitar', 'pe']) {
    let before = createInitialState();
    const route = routeTo(before, id);
    for (const point of route.slice(0, -1)) before = move(before, point);
    const after = move(before, route.at(-1));
    assert.equal(getArrivalMemory(before, after)?.id, id);
    const memory = MEMORY_TILES.find(tile => tile.id === id);
    assert.equal(canInspectMemory(before, memory), false);
    assert.equal(canInspectMemory(after, memory), true);
  }
});

test('the supplied fitness photograph unlocks at the fitness stop', () => {
  const initial = createInitialState();
  assert.equal(isPhotoUnlocked(initial, 'photo-27'), false);
  assert.equal(isPhotoUnlocked(move(initial, { q: -1, r: 0 }), 'photo-27'), false);
  const arrived = walkTo(initial, 'fitness');
  assert.deepEqual(getBuildingPhotoStatus(arrived, 'fitness'), { total: 1, unlocked: 1 });
  assert.equal(isPhotoUnlocked(arrived, 'photo-27'), true);
});
