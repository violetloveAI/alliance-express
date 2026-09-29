import test from 'node:test';
import assert from 'node:assert/strict';
import { ExplorationScene } from '../src/scene.js';
import { createInitialState, getAvailableMoves, getVisibleKeys, getTile, hexPosition, MEMORY_TILES, move, tileKey } from '../src/exploration.js';

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add: (value) => values.add(value),
    remove: (value) => values.delete(value),
    contains: (value) => values.has(value),
    toggle: (value, enabled) => enabled ? values.add(value) : values.delete(value),
  };
}

function target({ key, memory } = {}) {
  return {
    closest(selector) {
      if (selector === '[data-key]' && key) return { dataset: { key } };
      if (selector === '[data-memory]' && memory) return { dataset: { memory } };
      return null;
    },
  };
}

// Only the browser surface is stubbed. Scene event, camera, and tween methods,
// plus movement rules and memory lookup, run directly from the production modules.
function makeScene(state = createInitialState()) {
  const listeners = new Map();
  const captures = new Set();
  const attributes = new Map();
  const inspected = [];
  const locked = [];
  const zooms = [];
  const bounds = { left: 100, top: 50, width: 1000, height: 500 };
  const svg = {
    classList: classList(),
    addEventListener: (type, listener) => listeners.set(type, listener),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const scene = Object.create(ExplorationScene.prototype);
  const reachable = new Set(getAvailableMoves(state).map(tileKey));
  Object.assign(scene, {
    svg,
    state,
    moving: false,
    following: true,
    isOverview: false,
    camera: { x: 0, y: 0 },
    vehiclePosition: { x: 600, y: 300 },
    cameraTween: null,
    arrivalLayer: svgNode(),
    discoveryModels: new Set(),
    reduced: { matches: false },
    viewWidth: 1000,
    viewHeight: 500,
    normalWidth: 1000,
    ratio: 0.5,
    container: {
      get clientWidth() { return bounds.width; },
      getBoundingClientRect: () => bounds,
    },
    tiles: new Map([...getAvailableMoves(state), ...MEMORY_TILES].map((position) => [
      tileKey(position),
      { ...position, tile: getTile(position), model: svgNode(), g: { classList: classList(reachable.has(tileKey(position)) ? ['reachable'] : []) } },
    ])),
    onMove: (position) => { scene.state = move(scene.state, position); },
    onInspect: (memory) => inspected.push(memory),
    onLocked: (memory) => locked.push(memory),
    onZoom: (percent) => zooms.push(percent),
    onPan: () => {},
  });
  scene.installEvents();

  function emit(type, details = {}) {
    const event = {
      button: 0, pointerId: 1, clientX: 10, clientY: 10,
      target: target(), defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...details,
    };
    listeners.get(type)(event);
    return event;
  }

  return { scene, emit, inspected, locked, zooms, bounds, captures };
}

function animationClock(t) {
  const originals = new Map(['requestAnimationFrame', 'cancelAnimationFrame']
    .map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const frames = new Map();
  let sequence = 0;
  globalThis.requestAnimationFrame = (callback) => {
    const id = ++sequence;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  t.after(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return {
    frame(time) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(time);
    },
  };
}

function birthdayState() {
  let state = createInitialState();
  for (let step = 1; step <= 25; step += 1) {
    state = move(state, step % 2 ? { q: -1, r: 0 } : { q: 0, r: 0 });
  }
  return state;
}

test('one ordinary tap on an available tile advances exactly one step', () => {
  const { scene, emit } = makeScene();
  emit('pointerdown', { target: target({ key: '0,1' }) });
  emit('pointerup');
  assert.equal(scene.state.steps, 1);
  assert.deepEqual(scene.state.position, { q: 0, r: 1 });
});

test('panning the map changes the camera without moving the player', () => {
  const { scene, emit } = makeScene();
  const before = scene.state;
  emit('pointerdown', { target: target({ key: '0,1' }) });
  emit('pointermove', { clientX: 90, clientY: 10 });
  emit('pointerup');
  assert.equal(scene.state, before);
  assert.notDeepEqual(scene.camera, { x: 0, y: 0 });
});

for (const dragFirst of [false, true]) {
  test(`a second finger cannot turn ${dragFirst ? 'an existing pan' : 'a two-finger gesture'} into a move`, () => {
    const { scene, emit } = makeScene();
    const before = scene.state;
    const tile = target({ key: '0,1' });
    emit('pointerdown', { pointerId: 1, target: tile });
    if (dragFirst) emit('pointermove', { pointerId: 1, clientX: 90 });
    emit('pointerdown', { pointerId: 2, clientX: 100, clientY: 100, target: tile });
    emit('pointerup', { pointerId: 2 });
    emit('pointerup', { pointerId: 1 });
    assert.equal(scene.state, before);

    // The completed gesture must not leave the next intentional tap blocked.
    emit('pointerdown', { pointerId: 3, target: tile });
    emit('pointerup', { pointerId: 3 });
    assert.equal(scene.state.steps, 1);
  });
}

test('a cancelled pointer does not move and does not block the next tap', () => {
  const { scene, emit } = makeScene();
  const before = scene.state;
  const tile = target({ key: '0,1' });
  emit('pointerdown', { target: tile });
  emit('pointercancel');
  assert.equal(scene.state, before);
  emit('pointerdown', { pointerId: 2, target: tile });
  emit('pointerup', { pointerId: 2 });
  assert.equal(scene.state.steps, 1);
});

test('overview interrupts the real camera tween so its later frames cannot move the overview', async (t) => {
  const clock = animationClock(t);
  const { scene } = makeScene();
  scene.centerOnPlayer();
  const previousTween = scene.cameraTween;
  clock.frame(0);
  clock.frame(120);
  assert.notDeepEqual(scene.camera, { x: 0, y: 0 });

  scene.overview();
  assert.equal(scene.isOverview, true);
  assert.deepEqual(scene.camera, { x: 0, y: 0 });
  clock.frame(1000);
  assert.deepEqual(scene.camera, { x: 0, y: 0 });
  await previousTween.promise;
});

test('immediate centering cannot be overwritten by a previously animated destination', async (t) => {
  const clock = animationClock(t);
  const { scene } = makeScene();
  scene.centerOnPlayer();
  const previousTween = scene.cameraTween;
  clock.frame(0);

  scene.vehiclePosition = { x: -400, y: -200 };
  scene.centerOnPlayer(false);
  const immediateCamera = { ...scene.camera };
  assert.ok(immediateCamera.x < 0 && immediateCamera.y < 0);
  clock.frame(1000);
  assert.deepEqual(scene.camera, immediateCamera);
  await previousTween.promise;
});

test('resizing during a camera tween keeps the newly centered viewport', async (t) => {
  const clock = animationClock(t);
  const { scene, bounds } = makeScene();
  scene.centerOnPlayer();
  const previousTween = scene.cameraTween;
  clock.frame(0);

  bounds.width = 360;
  bounds.height = 500;
  scene.resize();
  const resizedCamera = { ...scene.camera };
  assert.notEqual(scene.viewHeight, 500);
  assert.notDeepEqual(resizedCamera, { x: 0, y: 0 });
  clock.frame(1000);
  assert.deepEqual(scene.camera, resizedCamera);
  await previousTween.promise;
});

for (const input of ['pointer', 'Enter', ' ']) {
  test(`after the birthday, ${input === ' ' ? 'Space' : input} opens unvisited memories without taking a step`, () => {
    const before = birthdayState();
    assert.equal(before.steps, 25);
    assert.equal(before.visited.includes('1,0'), false);
    const { scene, emit, inspected, locked } = makeScene(before);
    const memory = target({ memory: '1,0' });
    if (input === 'pointer') {
      emit('pointerdown', { target: memory });
      emit('pointerup');
    } else {
      const event = emit('keydown', { key: input, target: memory });
      assert.equal(event.defaultPrevented, true);
    }
    assert.deepEqual(inspected.map(tile => tile.id), ['canteen']);
    assert.deepEqual(locked, []);
    assert.equal(scene.state.visited.includes('1,0'), false);
    assert.equal(scene.state, before);
  });
}

test('before the birthday, an unvisited memory remains unavailable to pointer and Enter', () => {
  const { scene, emit, inspected, locked } = makeScene();
  const before = scene.state;
  const memory = target({ memory: '1,0' });
  emit('pointerdown', { target: memory });
  emit('pointerup');
  emit('keydown', { key: 'Enter', target: memory });
  assert.deepEqual(inspected, []);
  assert.equal(locked.length, 2);
  assert.ok(locked.every((tile) => !('description' in tile) && !('photoCategory' in tile)));
  assert.equal(scene.state, before);
});

for (const input of ['pointer', 'Enter', ' ']) {
  test(`a visited memory opens with ${input} without moving`, () => {
    const state = move(createInitialState(), { q: 1, r: 0 });
    const { scene, emit, inspected, locked } = makeScene(state);
    const memory = target({ memory: '1,0' });
    if (input === 'pointer') {
      emit('pointerdown', { target: memory });
      emit('pointerup');
    } else emit('keydown', { key: input, target: memory });
    assert.deepEqual(inspected.map((tile) => tile.id), ['canteen']);
    assert.deepEqual(locked, []);
    assert.equal(scene.state, state);
  });
}

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should equal ${expected}`);
}

function worldAt(scene, x, y, bounds) {
  return {
    x: scene.camera.x + (x / bounds.width - 0.5) * scene.viewWidth,
    y: scene.camera.y + (y / bounds.height - 0.5) * scene.viewHeight,
  };
}

test('zoom anchors the world under the cursor and reports the current percentage', () => {
  const { scene, bounds, zooms } = makeScene();
  const before = worldAt(scene, 700, 200, bounds);
  scene.zoomBy(2, { clientX: bounds.left + 700, clientY: bounds.top + 200 });
  assert.equal(scene.viewWidth, 500);
  assert.equal(scene.zoomPercent, 200);
  assert.equal(zooms.at(-1), 200);
  const after = worldAt(scene, 700, 200, bounds);
  close(after.x, before.x);
  close(after.y, before.y);
  scene.zoomOut();
  assert.equal(scene.viewWidth, 625);
  scene.zoomIn();
  assert.equal(scene.viewWidth, 500);
});

test('wheel zoom is anchored, prevents page scrolling, and never counts a move', () => {
  const { scene, emit, bounds } = makeScene();
  const initial = scene.state;
  const before = worldAt(scene, 800, 100, bounds);
  const event = emit('wheel', { clientX: bounds.left + 800, clientY: bounds.top + 100, deltaY: -120, deltaMode: 0 });
  assert.equal(event.defaultPrevented, true);
  assert.ok(scene.viewWidth < 1000);
  const after = worldAt(scene, 800, 100, bounds);
  close(after.x, before.x);
  close(after.y, before.y);
  assert.equal(scene.state, initial);
});

test('pinch changes scale around its midpoint without moving after either finger lifts', () => {
  const { scene, emit, bounds, captures } = makeScene();
  const tile = target({ key: '0,1' });
  const initial = scene.state;
  const before = worldAt(scene, 300, 200, bounds);
  emit('pointerdown', { pointerId: 1, clientX: 300, clientY: 250, target: tile });
  emit('pointerdown', { pointerId: 2, clientX: 500, clientY: 250, target: tile });
  emit('pointermove', { pointerId: 1, clientX: 200, clientY: 250 });
  emit('pointermove', { pointerId: 2, clientX: 600, clientY: 250 });
  close(scene.viewWidth, 500);
  const after = worldAt(scene, 300, 200, bounds);
  close(after.x, before.x);
  close(after.y, before.y);
  emit('pointerup', { pointerId: 1 });
  emit('pointermove', { pointerId: 2, clientX: 620, clientY: 250 });
  emit('pointerup', { pointerId: 2 });
  assert.equal(scene.state, initial);
  assert.equal(captures.size, 0);
});

test('third-finger interruption and lost capture cannot become an accidental tap', () => {
  const { scene, emit, captures } = makeScene();
  const tile = target({ key: '0,1' });
  const initial = scene.state;
  for (const id of [1, 2, 3]) emit('pointerdown', { pointerId: id, clientX: id * 100, target: tile });
  emit('pointercancel', { pointerId: 2 });
  emit('lostpointercapture', { pointerId: 1 });
  emit('pointerup', { pointerId: 3 });
  assert.equal(scene.state, initial);
  assert.equal(captures.size, 0);
  emit('pointerdown', { pointerId: 4, target: tile });
  emit('pointerup', { pointerId: 4 });
  assert.equal(scene.state.steps, 1);
});

test('zoom is bounded and preserved by resizing and returning to the train', () => {
  const { scene, bounds } = makeScene();
  scene.zoomBy(2);
  const zoom = scene.zoomPercent;
  bounds.width = 800;
  bounds.height = 400;
  scene.resize();
  assert.equal(scene.zoomPercent, zoom);
  const width = scene.viewWidth;
  scene.centerOnPlayer(false);
  assert.equal(scene.viewWidth, width);
  scene.zoomBy(1000);
  assert.equal(scene.viewWidth, 440);
  scene.zoomBy(0.00001);
  assert.ok(scene.viewWidth <= 5000);
  const clamped = scene.viewWidth;
  for (const factor of [0, -1, NaN, Infinity]) scene.zoomBy(factor);
  assert.equal(scene.viewWidth, clamped);
});

test('new zoom input cancels camera tween frames and flyTo preserves a custom scale', async (t) => {
  const clock = animationClock(t);
  const { scene } = makeScene();
  scene.centerOnPlayer();
  const oldTween = scene.cameraTween;
  clock.frame(0);
  scene.zoomBy(1.5);
  const camera = { ...scene.camera };
  const width = scene.viewWidth;
  clock.frame(1000);
  assert.deepEqual(scene.camera, camera);
  await oldTween.promise;
  scene.flyTo({ q: 2, r: 1 });
  clock.frame(1100);
  clock.frame(1600);
  assert.equal(scene.viewWidth, width);
  scene.overview();
  assert.ok(scene.viewWidth > width);
  scene.centerOnPlayer(false);
  assert.equal(scene.viewWidth, width);
});

function svgNode() {
  return {
    dataset: {}, style: {}, classList: classList(), attributes: new Map(), children: [],
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
  };
}

test('revealed models and locked labels appear before a visit, but hidden memories stay hidden', (t) => {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: () => svgNode() };
  t.after(() => { if (previous) globalThis.document = previous; else delete globalThis.document; });
  const { scene } = makeScene();
  scene.fogHoles = svgNode(); scene.fogLayer = svgNode(); scene.cake = svgNode();
  scene.tileLayer = svgNode(); scene.modelLayer = svgNode();
  scene.islandClip = svgNode(); scene.shorePaths = [];
  for (const entry of scene.tiles.values()) {
    const tile = getTile(entry);
    Object.assign(entry, hexPosition(entry.q, entry.r), { tile, model: svgNode(), memoryButton: tile.isMemory ? svgNode() : null });
  }
  scene.revealState(scene.state);
  const visible = scene.tiles.get('1,0');
  assert.equal(visible.model.dataset.revealed, 'true');
  assert.equal(visible.memoryButton.style.visibility, 'visible');
  assert.equal(visible.memoryButton.attributes.get('data-locked'), 'true');
  assert.match(visible.memoryButton.attributes.get('aria-label'), /未到访/);
  assert.equal(scene.tiles.get(tileKey(MEMORY_TILES.find(tile => tile.id === 'alliance'))).model.dataset.revealed, 'false');
  scene.state = move(scene.state, { q: 1, r: 0 });
  scene.revealState(scene.state);
  assert.equal(visible.memoryButton.attributes.get('data-locked'), 'false');
  assert.match(visible.memoryButton.attributes.get('aria-label'), /重看回忆/);
});

test('travel keeps the chosen zoom and an interrupted trip cannot repaint a replacement state', async (t) => {
  const clock = animationClock(t);
  const { scene } = makeScene();
  const revealed = [];
  scene.train = svgNode(); scene.trainFacing = svgNode();
  scene.paintTargets = () => {}; scene.paintRails = () => {};
  scene.revealState = (state) => revealed.push(state);
  scene.zoomBy(1.5);
  const width = scene.viewWidth;
  const destination = move(scene.state, { q: 1, r: 0 });
  const trip = scene.travel(destination);
  clock.frame(0);
  assert.equal(scene.viewWidth, width);
  const replacement = createInitialState();
  scene.setState(replacement);
  clock.frame(1000);
  await trip;
  assert.equal(scene.state, replacement);
  assert.equal(revealed.at(-1), replacement);
  assert.equal(scene.viewWidth, width);
});

test('edge gifts remain six choices and the extra cake cell can be revisited through scene input', () => {
  let state = createInitialState();
  for (let step = 1; step <= 18; step += 1) state = move(state, { q: step % 2, r: 0 });
  for (const position of [{ q: 0, r: 1 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }, { q: 5, r: 0 }]) state = move(state, position);
  assert.equal(state.steps, 24);
  assert.equal(getAvailableMoves(state).length, 6);
  for (const [index, key] of ['6,0', '5,0', '6,0', '5,0'].entries()) {
    const harness = makeScene(state);
    if (index % 2) harness.emit('keydown', { key: 'Enter', target: target({ key }) });
    else {
      harness.emit('pointerdown', { target: target({ key }) });
      harness.emit('pointerup');
    }
    state = harness.scene.state;
    assert.equal(state.steps, 25 + index);
    assert.equal(tileKey(state.position), key);
    assert.deepEqual(state.birthdayAt, { q: 6, r: 0 });
  }
});

test('a completed reduced-motion trip keeps custom scale while moving blocks zoom input', async () => {
  const { scene, emit } = makeScene();
  scene.train = svgNode(); scene.trainFacing = svgNode();
  scene.paintTargets = () => {}; scene.paintRails = () => {}; scene.revealState = () => {};
  scene.zoomBy(1.5);
  const width = scene.viewWidth;
  scene.moving = true;
  scene.zoomIn();
  emit('wheel', { deltaY: -100, deltaMode: 0 });
  assert.equal(scene.viewWidth, width);
  scene.moving = false;
  scene.reduced.matches = true;
  const destination = move(scene.state, { q: 1, r: 0 });
  await scene.travel(destination);
  assert.deepEqual(scene.vehiclePosition, hexPosition(1, 0));
  assert.equal(scene.viewWidth, width);
  assert.equal(scene.moving, false);
});

test('returning to the outer cake on step 27 reframes it without changing zoom or ordinary travel framing', async () => {
  let state = createInitialState();
  for (let step = 1; step <= 18; step += 1) state = move(state, { q: step % 2, r: 0 });
  for (const position of [{ q: 0, r: 1 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }, { q: 5, r: 0 }, { q: 6, r: 0 }, { q: 5, r: 0 }]) state = move(state, position);
  assert.equal(state.steps, 26);
  const { scene } = makeScene(state);
  scene.train = svgNode(); scene.trainFacing = svgNode();
  scene.paintTargets = () => {}; scene.paintRails = () => {}; scene.revealState = () => {};
  scene.reduced.matches = true;
  scene.zoomBy(1.5);
  const width = scene.viewWidth;
  const returned = move(state, { q: 6, r: 0 });
  await scene.travel(returned);
  assert.equal(scene.state.steps, 27);
  assert.equal(scene.camera.y, -120, 'the cake needs room above the train after every arrival');
  assert.equal(scene.viewWidth, width);
  await scene.travel(move(returned, { q: 5, r: 0 }));
  assert.equal(scene.state.steps, 28);
  close(scene.camera.y, scene.viewHeight * 0.08);
  assert.equal(scene.viewWidth, width);
});

for (const percent of [64, 125]) {
  for (const action of ['center', 'flyTo', 'travel']) {
    test(`${action} restores the exact ${percent}% user zoom after overview`, async () => {
      const { scene } = makeScene();
      scene.reduced.matches = true;
      scene.train = svgNode(); scene.trainFacing = svgNode();
      scene.paintTargets = () => {}; scene.paintRails = () => {}; scene.revealState = () => {};
      scene.zoomBy(percent / 100);
      const width = scene.viewWidth;
      scene.overview();
      assert.ok(scene.viewWidth > width);
      if (action === 'center') scene.centerOnPlayer(false);
      if (action === 'flyTo') scene.flyTo({ q: 2, r: 1 });
      if (action === 'travel') await scene.travel(move(scene.state, { q: 1, r: 0 }));
      assert.equal(scene.viewWidth, width);
      assert.equal(scene.zoomPercent, percent);
    });
  }
}

function movementScene(t, state = createInitialState()) {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: () => svgNode() };
  t.after(() => { if (previous) globalThis.document = previous; else delete globalThis.document; });
  const { scene } = makeScene(state);
  scene.train = svgNode(); scene.trainFacing = svgNode();
  scene.paintTargets = () => {}; scene.paintRails = () => {}; scene.revealState = () => {};
  scene.vehiclePosition = hexPosition(state.position.q, state.position.r);
  return scene;
}

for (const [startingStep, duration] of [[0, 380], [10, 480]]) {
  test(`movement feedback keeps the ${duration} ms trip and appears at the actual destination only after arrival`, async (t) => {
    const clock = animationClock(t);
    let before = createInitialState();
    for (let step = 1; step <= startingStep; step++) before = move(before, { q: step % 2, r: 0 });
    const scene = movementScene(t, before);
    scene.zoomBy(0.64);
    const width = scene.viewWidth;
    const destination = move(before, { q: 1, r: 0 });
    const trip = scene.travel(destination);
    assert.equal(scene.train.classList.contains('moving'), true);
    assert.equal(scene.arrivalLayer.children.length, 0);
    clock.frame(0);
    clock.frame(duration - 1);
    assert.equal(scene.moving, true);
    assert.equal(scene.arrivalLayer.children.length, 0);
    clock.frame(duration);
    await trip;
    assert.equal(scene.moving, false);
    assert.equal(scene.train.classList.contains('moving'), false);
    assert.equal(scene.arrivalLayer.children.length, 1);
    const at = hexPosition(1, 0);
    assert.equal(scene.arrivalLayer.attributes.get('transform'), `translate(${at.x} ${at.y + 30})`);
    assert.equal(scene.train.attributes.get('transform'), `translate(${at.x} ${at.y + 30})`);
    assert.equal(scene.viewWidth, width);
  });
}

test('only newly visible special buildings fade in, and a revisited area does not replay discovery', async (t) => {
  const clock = animationClock(t);
  const before = createInitialState();
  const scene = movementScene(t, before);
  const destination = move(before, { q: 1, r: 0 });
  const previouslyVisible = new Set(getVisibleKeys(before));
  const discoveries = getVisibleKeys(destination).filter(key => !previouslyVisible.has(key) && scene.tiles.get(key)?.tile.isMemory);
  assert.ok(discoveries.length > 0);
  let trip = scene.travel(destination);
  clock.frame(0); clock.frame(380); await trip;
  for (const [key, entry] of scene.tiles) {
    assert.equal(entry.model.classList.contains('memory-discovered'), discoveries.includes(key), key);
  }
  trip = scene.travel(move(destination, { q: 0, r: 0 }));
  assert.equal(scene.arrivalLayer.children.length, 0);
  assert.ok([...scene.tiles.values()].every(entry => !entry.model.classList.contains('memory-discovered')));
  clock.frame(400); clock.frame(780); await trip;
  assert.equal(scene.discoveryModels.size, 0);
});

test('reset clears arrival and discovery feedback and an interrupted trip cannot bring them back', async (t) => {
  const clock = animationClock(t);
  const scene = movementScene(t);
  let trip = scene.travel(move(scene.state, { q: 1, r: 0 }));
  clock.frame(0); clock.frame(380); await trip;
  assert.ok(scene.discoveryModels.size > 0);
  assert.equal(scene.arrivalLayer.children.length, 1);
  scene.setState(createInitialState());
  assert.equal(scene.arrivalLayer.children.length, 0);
  assert.equal(scene.discoveryModels.size, 0);
  assert.ok([...scene.tiles.values()].every(entry => !entry.model.classList.contains('memory-discovered')));
  trip = scene.travel(move(scene.state, { q: 1, r: 0 }));
  clock.frame(400);
  scene.setState(createInitialState());
  clock.frame(1000); await trip;
  assert.equal(scene.arrivalLayer.children.length, 0);
  assert.equal(scene.discoveryModels.size, 0);
  assert.equal(scene.train.classList.contains('moving'), false);
  assert.equal(scene.state.steps, 0);
});

test('reduced motion skips arrival and discovery effects while still completing the move', async (t) => {
  const scene = movementScene(t);
  scene.reduced.matches = true;
  const destination = move(scene.state, { q: 1, r: 0 });
  await scene.travel(destination);
  assert.equal(scene.state, destination);
  assert.deepEqual(scene.vehiclePosition, hexPosition(1, 0));
  assert.equal(scene.arrivalLayer.children.length, 0);
  assert.equal(scene.discoveryModels.size, 0);
  assert.equal(scene.train.classList.contains('moving'), false);
});

test('birthday-wide visibility does not animate every distant special building', async (t) => {
  const clock = animationClock(t);
  let before = createInitialState();
  for (let step = 1; step <= 24; step++) before = move(before, { q: step % 2, r: 0 });
  const scene = movementScene(t, before);
  const trip = scene.travel(move(before, { q: 1, r: 0 }));
  clock.frame(0); clock.frame(480); await trip;
  assert.equal(scene.discoveryModels.size, 0);
  assert.equal(scene.arrivalLayer.children.length, 1);
});
