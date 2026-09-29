import test from 'node:test';
import assert from 'node:assert/strict';

async function loadExploration() {
  try {
    return await import('../src/exploration.js');
  } catch (error) {
    assert.fail(`The free exploration API must load: ${error.message}`);
  }
}

const INITIAL = {
  version: 2, steps: 0, position: { q: 0, r: 0 },
  visited: ['0,0'], trail: [{ q: 0, r: 0 }], birthdayAt: null,
};
const radius = tile => Math.max(Math.abs(tile.q), Math.abs(tile.r), Math.abs(tile.q + tile.r));

function assertInitialState(state) {
  const { villageSeed, ...journey } = state;
  assert.ok(Number.isInteger(villageSeed) && villageSeed > 0 && villageSeed <= 0xffffffff);
  assert.deepEqual(journey, INITIAL);
}

function walkBackAndForth(api, steps) {
  let state = api.createInitialState();
  for (let step = 1; step <= steps; step += 1) {
    state = api.move(state, { q: step % 2, r: 0 });
  }
  return state;
}

test('a new expedition starts at the school with independent mutable state', async () => {
  const api = await loadExploration();
  assert.equal(api.STORAGE_KEY, 'water-sheep-explore:v2');
  const first = api.createInitialState();
  const second = api.createInitialState();
  assertInitialState(first);
  first.position.q = 1;
  first.visited.push('1,0');
  first.trail[0].r = 1;
  assertInitialState(second);
  assert.equal(api.getTile(second.position).isMemory, true);
  assert.equal(api.getTile(second.position).asset, 'school.webp');
});

test('the radius-five world has 91 cells and only reciprocal in-bounds neighbors', async () => {
  const { GRID_RADIUS, isInside, getNeighbors, tileKey } = await loadExploration();
  assert.equal(GRID_RADIUS, 5);
  let count = 0;
  for (let q = -6; q <= 6; q += 1) {
    for (let r = -6; r <= 6; r += 1) {
      const expected = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 5;
      assert.equal(isInside(q, r), expected);
      if (!expected) continue;
      count += 1;
      const neighbors = getNeighbors({ q, r });
      assert.equal(new Set(neighbors.map(tileKey)).size, neighbors.length);
      for (const neighbor of neighbors) {
        assert.ok(isInside(neighbor.q, neighbor.r));
        assert.equal(Math.max(Math.abs(neighbor.q - q), Math.abs(neighbor.r - r), Math.abs(neighbor.q + neighbor.r - q - r)), 1);
        assert.ok(getNeighbors(neighbor).some((point) => point.q === q && point.r === r));
      }
    }
  }
  assert.equal(count, 91);
  assert.deepEqual(new Set(getNeighbors({ q: 0, r: 0 }).map(tileKey)), new Set(['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1']));
  assert.equal(getNeighbors({ q: 5, r: 0 }).length, 3);
  for (const [q, r] of [[0.5, 0], [NaN, 0], [0, Infinity], ['0', 0]]) assert.equal(isInside(q, r), false);
});

test('players can move freely in all six adjacent directions without mutating previous state', async () => {
  const api = await loadExploration();
  const initial = api.createInitialState();
  Object.freeze(initial.position);
  Object.freeze(initial.trail[0]);
  Object.freeze(initial.trail);
  Object.freeze(initial.visited);
  Object.freeze(initial);
  for (const destination of api.getNeighbors(initial.position)) {
    const moved = api.move(initial, destination);
    assert.notEqual(moved, initial);
    assert.equal(moved.steps, 1);
    assert.deepEqual(moved.position, destination);
    assert.deepEqual(moved.visited, ['0,0', api.tileKey(destination)]);
    assert.deepEqual(moved.trail, [{ q: 0, r: 0 }, destination]);
    assert.equal(moved.birthdayAt, null);
    assert.equal(moved.villageSeed, initial.villageSeed);
  }
  assertInitialState(initial);
  const destination = { q: 1, r: 0 };
  const moved = api.move(initial, destination);
  destination.q = 4;
  assert.deepEqual(moved.position, { q: 1, r: 0 });
  assert.deepEqual(moved.trail.at(-1), { q: 1, r: 0 });
});

test('same-cell, distant, malformed, and out-of-bounds destinations do not count as moves', async () => {
  const api = await loadExploration();
  const state = api.createInitialState();
  for (const destination of [null, undefined, [], {}, { q: 0, r: 0 }, { q: 2, r: 0 }, { q: 6, r: 0 }, { q: 0.5, r: 0 }, { q: 1, r: NaN }]) {
    assert.equal(api.move(state, destination), state);
  }
  let edge = state;
  for (let q = 1; q <= 5; q += 1) edge = api.move(edge, { q, r: 0 });
  assert.equal(api.move(edge, { q: 6, r: 0 }), edge);
  assert.equal(api.move(edge, { q: 5, r: 1 }), edge);
  assert.equal(api.move(edge, { q: 5, r: -1 }).steps, 6);
});

test('revisiting counts every journey step without duplicating discovered tiles', async () => {
  const api = await loadExploration();
  const state = walkBackAndForth(api, 8);
  assert.equal(state.steps, 8);
  assert.equal(state.trail.length, 9);
  assert.deepEqual(state.position, { q: 0, r: 0 });
  assert.deepEqual(state.visited, ['0,0', '1,0']);
});

test('the 25th move places one birthday cake and later exploration keeps its original location', async () => {
  const api = await loadExploration();
  const before = walkBackAndForth(api, 24);
  assert.equal(before.birthdayAt, null);
  const birthday = api.move(before, { q: 1, r: 0 });
  assert.equal(birthday.steps, 25);
  assert.deepEqual(birthday.birthdayAt, { q: 1, r: 0 });
  const continued = api.move(birthday, { q: 1, r: -1 });
  assert.equal(continued.steps, 26);
  assert.deepEqual(continued.position, { q: 1, r: -1 });
  assert.deepEqual(continued.birthdayAt, { q: 1, r: 0 });
  assert.deepEqual(api.move(continued, { q: 2, r: -1 }).birthdayAt, { q: 1, r: 0 });
});

test('every saved step restores the same complete exploration before and after the birthday', async () => {
  const api = await loadExploration();
  let state = api.createInitialState();
  for (let step = 0; step <= 32; step += 1) {
    const restored = api.restoreState(api.serializeState(state));
    assert.deepEqual(restored, state);
    assert.notEqual(restored.trail, state.trail);
    assert.notEqual(restored.position, state.position);
    if (step < 32) state = api.move(state, api.getNeighbors(state.position)[step % api.getNeighbors(state.position).length]);
  }
});

test('restore reconstructs discovery and cake from the trail instead of trusting extra save fields', async () => {
  const api = await loadExploration();
  const unfinished = walkBackAndForth(api, 3);
  const finished = walkBackAndForth(api, 28);
  for (const expected of [unfinished, finished]) {
    const raw = JSON.stringify({ ...expected, visited: ['5,0', '5,0'], birthdayAt: { q: 5, r: 0 }, completed: true, unrelated: 'discard' });
    assert.deepEqual(api.restoreState(raw), expected);
  }
  const { visited, birthdayAt, ...minimal } = finished;
  assert.deepEqual(api.restoreState(JSON.stringify(minimal)), finished);
});

test('malformed or impossible saved trails reset safely to the school', async () => {
  const api = await loadExploration();
  const valid = walkBackAndForth(api, 2);
  const badSaves = [
    null, undefined, '', '{', 'not json', 'null', '[]', '42', '{}',
    JSON.stringify({ ...valid, version: 1 }),
    JSON.stringify({ ...valid, steps: -1 }),
    JSON.stringify({ ...valid, steps: 1.5 }),
    JSON.stringify({ ...valid, steps: 1 }),
    JSON.stringify({ ...valid, position: { q: 1, r: 0 } }),
    JSON.stringify({ ...valid, trail: [] }),
    JSON.stringify({ ...valid, trail: null }),
    JSON.stringify({ ...valid, trail: [{ q: 1, r: 0 }, { q: 1, r: 1 }, { q: 0, r: 1 }] }),
    JSON.stringify({ ...valid, trail: [{ q: 0, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 0 }] }),
    JSON.stringify({ ...valid, trail: [{ q: 0, r: 0 }, { q: 0, r: 0 }, { q: 0, r: 0 }] }),
    JSON.stringify({ ...valid, trail: [{ q: 0, r: 0 }, { q: 6, r: 0 }, { q: 0, r: 0 }] }),
    JSON.stringify({ ...valid, trail: [{ q: 0, r: 0 }, { q: 0.5, r: 0 }, { q: 0, r: 0 }] }),
  ];
  for (const raw of badSaves) assertInitialState(api.restoreState(raw));
  for (const invalid of [null, undefined, {}, { ...valid, steps: 10001 }]) {
    assert.equal(api.move(invalid, { q: 1, r: 0 }), invalid);
    assertInitialState(JSON.parse(api.serializeState(invalid)));
  }
});

test('the 10000-step save limit preserves a valid expedition and rejects further growth', async () => {
  const api = await loadExploration();
  const trail = Array.from({ length: 10001 }, (_, step) => ({ q: step % 2, r: 0 }));
  const state = api.restoreState(JSON.stringify({ version: 2, steps: 10000, position: { q: 0, r: 0 }, trail }));
  assert.equal(state.steps, 10000);
  assert.equal(api.move(state, { q: 1, r: 0 }), state);
  assert.deepEqual(api.getAvailableMoves(state), []);
  assert.deepEqual(api.restoreState(api.serializeState(state)), state);
  assertInitialState(api.restoreState(JSON.stringify({ ...state, steps: 10001, position: { q: 1, r: 0 }, trail: [...trail, { q: 1, r: 0 }] })));
});

test('hex positions use pointy centers compressed to the miniature map aspect ratio', async () => {
  const { TILE_SIZE, hexPosition } = await loadExploration();
  assert.equal(TILE_SIZE, 150);
  assert.deepEqual(hexPosition(0, 0), { x: 0, y: 0 });
  const east = hexPosition(1, 0);
  assert.ok(Math.abs(east.x - 259.8076211353316) < 1e-9);
  assert.equal(east.y, 0);
  const southeast = hexPosition(0, 1);
  assert.ok(Math.abs(southeast.x - 129.9038105676658) < 1e-9);
  assert.equal(southeast.y, 157.5);
  assert.deepEqual(hexPosition(-2, 2), { x: -259.8076211353316, y: 315 });
});

test('memory landmarks occupy unique known cells while the rest of the world stays open scenery', async () => {
  const { MEMORY_TILES, getTile, tileKey, isInside } = await loadExploration();
  assert.ok(MEMORY_TILES.length > 0 && MEMORY_TILES.length < 91 / 2, "most of the island should remain open scenery");
  assert.equal(new Set(MEMORY_TILES.map(tileKey)).size, MEMORY_TILES.length);
  assert.equal(new Set(MEMORY_TILES.map((tile) => tile.id)).size, MEMORY_TILES.length);
  for (const tile of MEMORY_TILES) {
    assert.ok(isInside(tile.q, tile.r));
    assert.equal(getTile(tile).id, tile.id);
    assert.equal(tile.isMemory, true);
    assert.ok(tile.title.length > 0);
    assert.ok(tile.description.length > 0);
  }
  for (const position of [{ q: 1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: -1 }, { q: 2, r: -1 }, { q: -3, r: 1 }, { q: 1, r: 2 }]) {
    assert.equal(getTile(position).isMemory, true);
  }
  assert.equal(getTile({ q: 5, r: 0 }).isMemory, false);
  assert.equal(getTile({ q: 5, r: 0 }).asset, null);
  assert.equal(getTile({ q: 6, r: 0 }).isMemory, false);
  assert.equal(getTile({ q: 7, r: 0 }), null);
});

function birthdayEveAtEdge(api) {
  let state = walkBackAndForth(api, 18);
  for (const destination of [{ q: 0, r: 1 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }, { q: 5, r: 0 }]) {
    state = api.move(state, destination);
  }
  assert.equal(state.steps, 24);
  return state;
}

test('fog initially reveals seven cells and permanently retains the halo of each visited cell', async () => {
  const api = await loadExploration();
  const initial = api.createInitialState();
  assert.deepEqual(new Set(api.getVisibleKeys(initial)), new Set(['0,0', '1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1']));
  const first = api.move(initial, { q: 1, r: 0 });
  const second = api.move(first, { q: 2, r: 0 });
  assert.equal(api.getVisibleKeys(first).length, 10);
  assert.equal(api.getVisibleKeys(second).length, 13);
  assert.ok(api.getVisibleKeys(second).includes('-1,0'));
  const returned = api.move(second, { q: 1, r: 0 });
  assert.deepEqual(api.getVisibleKeys(returned), api.getVisibleKeys(second));
  assert.deepEqual(returned.visited, ['0,0', '1,0', '2,0']);
  assert.deepEqual(api.getVisibleKeys(api.restoreState(api.serializeState(returned))), api.getVisibleKeys(returned));
});

test('the birthday reveals all 91 map cells without treating unvisited cells as visited', async () => {
  const api = await loadExploration();
  const before = walkBackAndForth(api, 24);
  assert.equal(api.getVisibleKeys(before).length, 10);
  const birthday = api.move(before, { q: 1, r: 0 });
  const visible = api.getVisibleKeys(birthday);
  assert.equal(visible.length, 91);
  assert.equal(new Set(visible).size, 91);
  assert.ok(visible.includes('5,0') && visible.includes('-5,5'));
  assert.deepEqual(birthday.visited, ['0,0', '1,0']);
  assert.equal(api.getVisibleKeys(api.move(birthday, { q: 1, r: -1 })).length, 91);
});

test('birthday eve offers six gifts even at the edge, and the outside cake allows an inward return', async () => {
  const api = await loadExploration();
  const before = birthdayEveAtEdge(api);
  assert.deepEqual(new Set(api.getAvailableMoves(before).map(api.tileKey)), new Set(['6,0', '6,-1', '5,-1', '4,0', '4,1', '5,1']));
  for (const destination of api.getAvailableMoves(before)) {
    const birthday = api.move(before, destination);
    assert.equal(birthday.steps, 25);
    assert.deepEqual(birthday.birthdayAt, destination);
    assert.deepEqual(api.restoreState(api.serializeState(birthday)), birthday);
    const isOutside = !api.isInside(destination.q, destination.r);
    assert.equal(api.getVisibleKeys(birthday).length, isOutside ? 92 : 91);
    assert.ok(api.getVisibleKeys(birthday).includes(api.tileKey(destination)));
    const available = api.getAvailableMoves(birthday);
    assert.ok(available.length > 0);
    assert.ok(available.every(({ q, r }) => api.isInside(q, r)));
    const returned = api.move(birthday, { q: 5, r: 0 });
    assert.equal(returned.steps, 26);
    assert.deepEqual(returned.birthdayAt, destination);
    assert.deepEqual(api.restoreState(api.serializeState(returned)), returned);
    assert.equal(api.getVisibleKeys(returned).length, isOutside ? 92 : 91);
  }
  assert.equal(api.isInside(6, 0), false);
  const outerBirthday = api.move(before, { q: 6, r: 0 });
  assert.equal(api.move(outerBirthday, { q: 6, r: -1 }), outerBirthday);
  assert.deepEqual(api.getNeighbors({ q: 6, r: 0 }), [{ q: 5, r: 0 }]);
});

test('save replay rejects arbitrary outside cells before and after the birthday', async () => {
  const api = await loadExploration();
  const before = birthdayEveAtEdge(api);
  const birthday = api.move(before, { q: 6, r: 0 });
  const invalidAfter = { ...birthday, steps: 26, position: { q: 6, r: -1 }, trail: [...birthday.trail, { q: 6, r: -1 }] };
  assertInitialState(api.restoreState(JSON.stringify(invalidAfter)));
  const earlyTrail = Array.from({ length: 7 }, (_, q) => ({ q, r: 0 }));
  assertInitialState(api.restoreState(JSON.stringify({ version: 2, steps: 6, position: { q: 6, r: 0 }, trail: earlyTrail })));
  const distantBirthday = { ...birthday, position: { q: 7, r: 0 }, trail: [...before.trail, { q: 7, r: 0 }] };
  assertInitialState(api.restoreState(JSON.stringify(distantBirthday)));
});

test('the created outer cake cell remains revisitable after returning to the main map', async () => {
  const api = await loadExploration();
  const before = birthdayEveAtEdge(api);
  const cake = { q: 6, r: 0 };
  const birthday = api.move(before, cake);
  const returned = api.move(birthday, { q: 5, r: 0 });
  assert.equal(returned.steps, 26);
  assert.ok(api.getAvailableMoves(returned).some((point) => api.tileKey(point) === '6,0'));
  assert.equal(api.move(returned, { q: 6, r: -1 }), returned);
  assert.equal(api.move(returned, { q: 5, r: 1 }), returned);
  const revisited = api.move(returned, cake);
  assert.equal(revisited.steps, 27);
  assert.deepEqual(revisited.position, cake);
  assert.deepEqual(revisited.birthdayAt, cake);
  assert.deepEqual(api.restoreState(api.serializeState(revisited)), revisited);
  assert.equal(api.move(revisited, { q: 6, r: -1 }), revisited);
  const backInside = api.move(revisited, { q: 5, r: 0 });
  assert.equal(backInside.steps, 28);
  assert.deepEqual(api.restoreState(api.serializeState(backInside)), backInside);
  assert.equal(api.getVisibleKeys(backInside).length, 92);
  assert.equal(backInside.visited.filter((key) => key === '6,0').length, 1);
  const away = api.move(backInside, { q: 4, r: 0 });
  assert.ok(!api.getAvailableMoves(away).some((point) => api.tileKey(point) === '6,0'));
  assert.equal(api.move(away, cake), away);
});

test('ordinary available moves stay bounded, and invalid or capped states expose no moves', async () => {
  const api = await loadExploration();
  let edge = api.createInitialState();
  for (let q = 1; q <= 5; q += 1) edge = api.move(edge, { q, r: 0 });
  assert.deepEqual(api.getAvailableMoves(edge), api.getNeighbors(edge.position));
  for (const state of [null, {}, { ...INITIAL, steps: 24 }]) assert.deepEqual(api.getAvailableMoves(state), []);
});

test('scattered hobby markers need no photos and all linked photo categories exist', async () => {
  const { MEMORY_TILES } = await loadExploration();
  const categories = new Set(['campus', 'portraits', 'dining', 'journeys', 'exhibitions', 'objects']);
  for (const tile of MEMORY_TILES) {
    assert.ok(tile.photoCategory === null || categories.has(tile.photoCategory));
  }
  for (const id of ['alliance', 'supply', 'badminton']) {
    const tile = MEMORY_TILES.find((entry) => entry.id === id);
    assert.ok(tile, `missing hobby marker ${id}`);
    assert.equal(tile.photoCategory, null);
  }
});

test('the expanded memories occupy distinct walkable cells and keep nearby ordinary scenery open', async () => {
  const { MEMORY_TILES, getTile } = await loadExploration();
  assert.equal(MEMORY_TILES.length, 33);
  assert.equal(MEMORY_TILES.filter(tile => tile.kind === 'easter-egg').length, 14);
  assert.equal(MEMORY_TILES.filter(tile => tile.kind !== 'easter-egg').length, 19);
  for (const [id, q, r] of [
    ['classphoto', -2, 2], ['reunion2023', 0, 4],
    ['museum', -1, -3], ['sanguosha', -3, 3], ['hearthstone', 2, -4],
  ]) {
    assert.equal(getTile({ q, r }).id, id);
  }
  for (const id of ['jinggangshan', 'love']) {
    const tile = MEMORY_TILES.find(entry => entry.id === id);
    assert.ok(tile, `missing memory ${id}`);
    assert.equal(getTile(tile).id, id);
  }
  assert.equal(getTile({ q: 1, r: -1 }).isMemory, false);
  assert.equal(getTile({ q: 0, r: 1 }).isMemory, false);
});

test('all 38 fixed landmarks occupy unique inner cells', async () => {
  const api = await loadExploration();
  const landmarks = [...api.MEMORY_TILES, ...api.VILLAGE_TILES];
  assert.equal(landmarks.length, 38);
  assert.equal(new Set(landmarks.map(tile => tile.id)).size, 38);
  assert.equal(new Set(landmarks.map(api.tileKey)).size, 38);
  assert.deepEqual(landmarks.filter(tile => radius(tile) >= api.GRID_RADIUS).map(tile => tile.id), [], 'fixed landmarks must stay inside the outer ring');
  for (const tile of landmarks) assert.equal(api.getTile(tile).id, tile.id);
});

test('all 30 cells in the outermost ring remain ordinary scenery without fixed discoveries', async () => {
  const api = await loadExploration();
  const outer = [];
  for (let q = -api.GRID_RADIUS; q <= api.GRID_RADIUS; q++) {
    for (let r = -api.GRID_RADIUS; r <= api.GRID_RADIUS; r++) {
      if (radius({ q, r }) === api.GRID_RADIUS) outer.push(api.getTile({ q, r }));
    }
  }
  assert.equal(outer.length, 30);
  assert.deepEqual(outer.filter(tile => tile.isMemory || tile.isVillage).map(tile => tile.id), []);
  for (const tile of outer) {
    assert.equal(tile.isMemory, false);
    assert.equal(tile.isVillage, false);
    assert.equal(tile.asset, null);
  }
});

test('the opening keeps three neighboring memories and each inner ring retains discoveries and open ground', async () => {
  const api = await loadExploration();
  const nearby = api.getNeighbors({ q: 0, r: 0 }).map(api.getTile);
  assert.deepEqual(nearby.filter(tile => tile.isMemory).map(tile => tile.id).sort(), ['canteen', 'dorm', 'metro']);
  assert.equal(nearby.some(tile => tile.isVillage), false);
  assert.equal(nearby.filter(tile => !tile.isMemory && !tile.isVillage).length, 3);
  assert.equal(api.getTile({ q: 1, r: 0 }).id, 'canteen');
  assert.equal(api.getTile({ q: -1, r: 1 }).id, 'dorm');
  assert.equal(api.getTile({ q: 0, r: -1 }).id, 'metro');
  for (let ring = 2; ring < api.GRID_RADIUS; ring++) {
    const memories = api.MEMORY_TILES.filter(tile => radius(tile) === ring);
    const villages = api.VILLAGE_TILES.filter(tile => radius(tile) === ring);
    assert.ok(memories.length >= 5, `ring ${ring} needs discoveries beyond the starting cluster`);
    assert.ok(memories.length + villages.length < ring * 6, `ring ${ring} needs open ground`);
  }
  const initialVisible = new Set(api.getVisibleKeys(api.createInitialState()));
  assert.deepEqual(api.MEMORY_TILES.filter(tile => initialVisible.has(api.tileKey(tile))).map(tile => tile.id).sort(), ['canteen', 'dorm', 'metro', 'school']);
});
