import test from 'node:test';
import assert from 'node:assert/strict';
import { ExplorationScene } from '../src/scene.js';
import { createInitialState, getVisibleKeys, hexPosition, move, tileKey } from '../src/exploration.js';

// Minimal browser boundary: all scene construction, visibility, input, state,
// cancellation, and animation scheduling run through the production class.
function node(tag = 'g') {
  const classes = new Set();
  const result = {
    tag, attributes: new Map(), dataset: {}, style: {}, children: [], parent: null,
    listeners: new Map(), captures: new Set(),
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'class') { classes.clear(); String(value).split(/\s+/).forEach(item => classes.add(item)); }
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    removeAttribute(name) { this.attributes.delete(name); },
    append(...children) { for (const child of children) { child.remove(); child.parent = this; this.children.push(child); } },
    replaceChildren(...children) { for (const child of [...this.children]) child.remove(); this.append(...children); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; },
    addEventListener(name, callback) { this.listeners.set(name, callback); },
    setPointerCapture(id) { this.captures.add(id); },
    hasPointerCapture(id) { return this.captures.has(id); },
    releasePointerCapture(id) { this.captures.delete(id); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
  };
  return result;
}

function harness(t, { reduced = false, state = createInitialState() } = {}) {
  const originals = new Map(['document', 'Image', 'matchMedia', 'ResizeObserver', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame']
    .map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const timers = new Map(), frames = new Map(), images = [];
  let sequence = 0, now = 0;
  Object.assign(globalThis, {
    document: { createElementNS: (_, tag) => node(tag) },
    Image: class {
      complete = false;
      naturalWidth = 0;
      set src(value) { this.url = value; if (value) images.push(this); }
      decode() { return new Promise(resolve => { this.finishDecode = resolve; }); }
      load() { this.complete = true; this.naturalWidth = 512; this.onload?.(); }
      fail() { this.complete = true; this.onerror?.(); }
    },
    matchMedia: () => ({ matches: reduced }),
    ResizeObserver: class { observe() {} },
    setTimeout: (callback, duration) => { const id = ++sequence; timers.set(id, { at: now + duration, callback }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  t.after(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const moves = [];
  const scene = new ExplorationScene(node('div'), { onMove: position => moves.push(position), onInspect: () => {} });
  scene.setState(state);
  return {
    scene, moves, images,
    frame(time) { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(time); },
    advance(duration) {
      const end = now + duration;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next; now = timer.at; timers.delete(id); timer.callback();
      }
      now = end;
    },
    pendingTimers: () => timers.size,
  };
}

test('first arrival reveals the existing state in 900 ms without counting a step or accepting movement', async t => {
  const clock = harness(t), { scene, moves } = clock;
  const state = scene.state, trail = JSON.stringify(state.trail);
  scene.zoomBy(1.25);
  const width = scene.viewWidth, coordinates = scene.train.attributes.get('transform');
  scene.trainFacing.setAttribute('transform', 'scale(-1 1)');
  const arrival = scene.playArrival();
  assert.equal(scene.moving, true);
  assert.equal(scene.svg.classList.contains('arriving'), true);
  assert.equal(scene.train.classList.contains('entering'), true);
  assert.equal(scene.trainFacing.attributes.get('transform'), 'scale(1 1)');
  assert.equal(scene.markerLayer.children.length, 0);
  const input = { key: 'Enter', target: { closest: selector => selector === '[data-key]' ? { dataset: { key: '1,0' } } : null }, preventDefault() {} };
  scene.svg.listeners.get('keydown')(input);
  assert.deepEqual(moves, []);
  clock.advance(899);
  assert.equal(scene.moving, true);
  clock.advance(1);
  assert.equal(await arrival, state);
  assert.equal(scene.moving, false);
  assert.equal(scene.svg.classList.contains('arriving'), false);
  assert.equal(scene.train.classList.contains('entering'), false);
  assert.equal(scene.train.attributes.get('transform'), coordinates);
  assert.equal(scene.markerLayer.children.length, 6);
  assert.equal(scene.state.steps, 0);
  assert.equal(JSON.stringify(scene.state.trail), trail);
  assert.equal(scene.viewWidth, width);
  assert.equal(scene.discoveryModels.size, 0, 'arrival must not call existing visible memories newly discovered');
  clock.advance(300);
  assert.equal(clock.pendingTimers(), 0);
  assert.equal(scene.train.classList.contains('settling'), false);
  assert.equal(scene.arrivalLayer.children.length, 0);
});

test('reset resolves the interrupted arrival and removes every temporary class and timer', async t => {
  const clock = harness(t), { scene } = clock;
  const arrival = scene.playArrival();
  clock.advance(300);
  const replacement = move(createInitialState(), { q: 1, r: 0 });
  scene.setState(replacement);
  assert.equal(await arrival, replacement);
  assert.equal(clock.pendingTimers(), 0);
  assert.equal(scene.moving, false);
  assert.equal(scene.svg.classList.contains('arriving'), false);
  assert.equal(scene.train.classList.contains('entering'), false);
  clock.advance(2000);
  assert.equal(scene.state, replacement);
  assert.deepEqual(scene.vehiclePosition, hexPosition(1, 0));
  assert.equal(scene.arrivalLayer.children.length, 0);
});

test('restarting an arrival resolves the older call without letting it finish the newer presentation', async t => {
  const clock = harness(t), { scene } = clock;
  const first = scene.playArrival();
  clock.advance(300);
  const second = scene.playArrival();
  await first;
  assert.equal(scene.moving, true);
  assert.equal(clock.pendingTimers(), 1);
  clock.advance(600);
  assert.equal(scene.moving, true);
  clock.advance(300);
  await second;
  assert.equal(scene.moving, false);
  assert.equal(scene.state.steps, 0);
});

test('travel can supersede an arrival without allowing its cancelled completion to repaint the train', async t => {
  const clock = harness(t), { scene } = clock;
  const arrival = scene.playArrival();
  clock.advance(200);
  const destination = move(scene.state, { q: 1, r: 0 });
  const trip = scene.travel(destination);
  await arrival;
  assert.equal(scene.moving, true);
  assert.equal(scene.svg.classList.contains('arriving'), false);
  assert.equal(scene.train.classList.contains('entering'), false);
  clock.frame(0); clock.frame(380);
  assert.equal(await trip, destination);
  clock.advance(2000);
  assert.equal(scene.state.steps, 1);
  assert.deepEqual(scene.vehiclePosition, hexPosition(1, 0));
});

test('reduced-motion arrival finishes immediately and preserves a restored journey', async t => {
  const restored = move(createInitialState(), { q: 1, r: 0 });
  const clock = harness(t, { reduced: true, state: restored }), { scene } = clock;
  assert.equal(await scene.playArrival(), restored);
  assert.equal(clock.pendingTimers(), 0);
  assert.equal(scene.animation, null);
  assert.equal(scene.moving, false);
  assert.equal(scene.svg.classList.contains('arriving'), false);
  assert.equal(scene.train.classList.contains('entering'), false);
  assert.equal(scene.discoveryModels.size, 0);
  assert.equal(scene.arrivalLayer.children.length, 0);
  assert.equal(scene.state.steps, 1);
  assert.deepEqual(scene.vehiclePosition, hexPosition(1, 0));
});

test('discovery effects are temporary, keep tile coordinates and locks, and do not replay on revisits', async t => {
  const clock = harness(t), { scene } = clock;
  const before = new Set(getVisibleKeys(scene.state));
  const destination = move(scene.state, { q: 1, r: 0 });
  const expected = getVisibleKeys(destination).filter(key => !before.has(key) && scene.tiles.get(key)?.tile.isMemory);
  assert.ok(expected.length > 0);
  const trip = scene.travel(destination);
  clock.frame(0); clock.frame(380); await trip;
  assert.equal(scene.discoveryModels.size, expected.length);
  for (const [key, tile] of scene.tiles) {
    assert.equal(tile.model.classList.contains('memory-discovered'), expected.includes(key));
    assert.equal(tile.model.attributes.get('transform'), `translate(${tile.x} ${tile.y})`);
    if (expected.includes(key)) {
      assert.equal(tile.memoryButton.attributes.get('data-locked'), 'true');
      assert.ok(tile.discoveryParts.every(part => part !== tile.model));
    }
  }
  assert.equal(scene.tiles.get(tileKey(destination.position)).model.classList.contains('memory-discovered'), false,
    'arriving at a previously visible memory is separate from discovering one in the fog');
  clock.advance(1000);
  assert.equal(clock.pendingTimers(), 0);
  assert.equal(scene.discoveryModels.size, 0);
  assert.equal(scene.arrivalLayer.children.length, 0);
  assert.ok([...scene.tiles.values()].every(tile => !tile.model.classList.contains('memory-discovered')));
  assert.ok([...scene.tiles.values()].every(tile => tile.discoveryParts.every(part => part.style.animationDelay === '')));
  const back = scene.travel(move(destination, { q: 0, r: 0 }));
  clock.frame(400); clock.frame(780); await back;
  assert.equal(scene.discoveryModels.size, 0);
});

const descendants = root => [root, ...root.children.flatMap(descendants)];
const artworkNodes = root => descendants(root).filter(item => item.tag === 'image');
const flushAssets = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function finishImages(clock) {
  for (let pass = 0; pass < 80; pass++) {
    for (const image of clock.images.filter(item => !item.complete)) image.load();
    await flushAssets();
    for (const image of clock.images) image.finishDecode?.();
    await flushAssets();
    if (clock.images.every(image => image.complete) && clock.pendingTimers() === 0) return;
  }
  assert.fail('image preparation never settled');
}

// A constructor that assigns SVG href, even to hidden tiles, starts downloads
// before the cover. Initial state painting must preserve the dormant state.
test('constructing and painting a map leaves all artwork dormant until preparation', t => {
  const clock = harness(t), art = artworkNodes(clock.scene.svg);
  assert.ok(art.length > 30);
  assert.ok(art.every(image => image.getAttribute('href') === null));
  assert.ok(art.every(image => image.getAttribute('data-src')?.includes('/assets/map/')));
  assert.equal(clock.images.length, 0);
  clock.scene.setState(move(clock.scene.state, { q: 1, r: 0 }));
  assert.equal(clock.images.length, 0);
  assert.ok(art.every(image => image.getAttribute('href') === null));
});

// Preparing all tiles, assigning href before decode, or restarting already
// prepared URLs would each violate the loading screen's readiness contract.
test('preparation decodes only visible artwork with bounded concurrency and reusable results', async t => {
  const clock = harness(t), { scene } = clock, progress = [];
  assert.equal(typeof scene.prepareAssets, 'function');
  const preparing = scene.prepareAssets(scene.state, { onProgress: value => progress.push(value) });
  assert.ok(clock.images.length > 0 && clock.images.length <= 3);
  const initial = [...clock.images];
  const terrain = artworkNodes(scene.landSurface)[0];
  assert.equal(terrain.getAttribute('href'), null);
  initial.forEach(image => image.load());
  await flushAssets();
  assert.equal(terrain.getAttribute('href'), null, 'download completion must wait for decode');
  assert.equal(clock.images.length, initial.length, 'decode holds a concurrency slot');
  await finishImages(clock);
  const result = await preparing;
  assert.equal(result.failed, 0);
  assert.equal(result.completed, result.total);
  assert.ok(result.total > 2 && result.total < artworkNodes(scene.svg).length);
  const visible = new Set(getVisibleKeys(scene.state));
  for (const [key, tile] of scene.tiles) {
    assert.ok(artworkNodes(tile.modelArt).every(image => Boolean(image.getAttribute('href')) === visible.has(key)), key);
  }
  assert.equal(artworkNodes(scene.cake)[0].getAttribute('href'), null);
  assert.ok(terrain.getAttribute('href').endsWith('/assets/map/terrain/flat-meadow-g.webp'));
  assert.deepEqual(progress.at(-1), result);
  const requestCount = clock.images.length;
  await scene.prepareAssets(scene.state);
  assert.equal(clock.images.length, requestCount);
  assert.equal(clock.pendingTimers(), 0);
});

// One stalled/erroring image must not trap the user behind a loading screen.
test('failed or stalled map images settle progress and keep a missing-image fallback', async t => {
  const clock = harness(t), { scene } = clock;
  assert.equal(typeof scene.prepareAssets, 'function');
  const preparing = scene.prepareAssets(scene.state);
  const failedUrl = clock.images[0].url;
  clock.images[0].fail();
  await flushAssets();
  clock.advance(15000);
  await flushAssets();
  await finishImages(clock);
  const result = await preparing;
  assert.ok(result.failed >= 2);
  assert.equal(result.completed, result.total);
  const failedNode = artworkNodes(scene.svg).find(image => image.getAttribute('data-src') === failedUrl);
  assert.equal(failedNode.getAttribute('href'), null);
  assert.equal(clock.pendingTimers(), 0);
});

test('a later preparation retries a failed image and restores its artwork after recovery', async t => {
  const clock = harness(t), { scene } = clock;
  const first = scene.prepareAssets(scene.state);
  const url = clock.images[0].url;
  clock.images[0].fail();
  await finishImages(clock);
  assert.equal((await first).failed, 1);
  const artwork = artworkNodes(scene.svg).find(image => image.getAttribute('data-src') === url);
  assert.equal(artwork.style.display, 'none');
  assert.equal(clock.images.filter(image => image.url === url).length, 1, 'do not loop retries inside one preparation');
  const next = scene.prepareAssets(scene.state);
  assert.equal(clock.images.filter(image => image.url === url).length, 2);
  await finishImages(clock);
  assert.equal((await next).failed, 0);
  assert.equal(artwork.getAttribute('href'), url);
  assert.equal(artwork.style.display, '');
});

// Newly discovered artwork may load after activation; undiscovered tiles and
// the birthday cake must stay dormant before their reveal.
test('activated maps prepare incoming discoveries and defer the cake until step 25', async t => {
  const clock = harness(t, { reduced: true }), { scene } = clock;
  assert.equal(typeof scene.prepareAssets, 'function');
  const preparing = scene.prepareAssets(scene.state);
  await finishImages(clock); await preparing;
  const before = new Set(getVisibleKeys(scene.state));
  const next = move(scene.state, { q: 1, r: 0 });
  await scene.travel(next);
  const newTiles = [...scene.tiles].filter(([key]) => getVisibleKeys(next).includes(key) && !before.has(key));
  assert.ok(newTiles.some(([, tile]) => artworkNodes(tile.modelArt).length));
  await finishImages(clock);
  for (const [, tile] of newTiles) assert.ok(artworkNodes(tile.modelArt).every(image => image.getAttribute('href')));
  assert.equal(artworkNodes(scene.cake)[0].getAttribute('href'), null);
  let birthday = next;
  for (let step = 2; step <= 25; step++) birthday = move(birthday, { q: step % 2, r: 0 });
  scene.setState(birthday);
  await finishImages(clock);
  assert.ok(artworkNodes(scene.cake)[0].getAttribute('href')?.endsWith('/assets/map/cake.webp'));
});
