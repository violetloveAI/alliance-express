import assert from 'node:assert/strict';
import { MEMORY_TILES, VILLAGE_TILES, getNeighbors, move, tileKey } from '../../src/exploration.js';

export const memoryTile = id => MEMORY_TILES.find(tile => tile.id === id);
export const villageTile = id => VILLAGE_TILES.find(tile => tile.id === id);

// Test routes follow real neighbor rules and avoid incidental village rewards.
// The destination can only appear as the final step of the shortest route.
export function routeTo(state, target, { avoidVillages = true, avoidIds = [] } = {}) {
  const destination = typeof target === 'string' ? memoryTile(target) ?? villageTile(target) : target;
  assert.ok(destination, `unknown map destination: ${target}`);
  const goal = tileKey(destination), seen = new Set([tileKey(state.position)]);
  const excluded = new Set([
    ...(avoidVillages ? VILLAGE_TILES : []),
    ...avoidIds.map(id => memoryTile(id) ?? villageTile(id)).filter(Boolean),
  ].map(tileKey));
  excluded.delete(goal);
  const queue = [{ point: state.position, path: [] }];
  for (let index = 0; index < queue.length; index++) {
    const { point, path } = queue[index];
    if (tileKey(point) === goal) return path;
    for (const neighbor of getNeighbors(point)) {
      const key = tileKey(neighbor);
      if (seen.has(key) || excluded.has(key)) continue;
      seen.add(key); queue.push({ point: neighbor, path: [...path, neighbor] });
    }
  }
  assert.fail(`no walkable route to ${goal}`);
}

export function walkTo(state, target, options) {
  for (const point of routeTo(state, target, options)) {
    const next = move(state, point);
    assert.equal(next.steps, state.steps + 1, `route cannot move to ${tileKey(point)}`);
    state = next;
  }
  return state;
}
