import test from 'node:test';
import assert from 'node:assert/strict';
import * as sceneApi from '../src/scene.js';
import { createInitialState, getAvailableMoves, hexPosition, move, tileKey } from '../src/exploration.js';

function area(points) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function contains(points, point) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function eveAtEdge() {
  let state = createInitialState();
  for (let step = 1; step <= 18; step += 1) state = move(state, { q: step % 2, r: 0 });
  for (const point of [{ q: 0, r: 1 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }, { q: 5, r: 0 }]) state = move(state, point);
  return state;
}

test('the main island follows the union of 91 full hexes as one rounded outer coast', () => {
  assert.equal(typeof sceneApi.buildIslandOutline, 'function');
  const outline = sceneApi.buildIslandOutline(createInitialState());
  assert.equal(outline.keys.length, 91);
  assert.equal(outline.points.length, 66);
  const fullHexArea = 3 * Math.sqrt(3) / 2 * 150 ** 2 * 0.7;
  assert.ok(Math.abs(area(outline.points) - 91 * fullHexArea) < 0.1);
  assert.equal((outline.path.match(/M/g) ?? []).length, 1);
  assert.equal((outline.path.match(/Z/g) ?? []).length, 1);
  assert.equal((outline.path.match(/Q/g) ?? []).length, 66);
  for (const key of outline.keys) {
    const [q, r] = key.split(',').map(Number);
    assert.ok(contains(outline.points, hexPosition(q, r)), key);
  }
  assert.equal(contains(outline.points, hexPosition(6, 0)), false);
  assert.equal(contains(outline.points, hexPosition(0, 6)), false);
});

test('the birthday-eve coast temporarily includes every outer gift without separating the island', () => {
  const before = eveAtEdge();
  const outline = sceneApi.buildIslandOutline(before);
  assert.equal(outline.keys.length, 94);
  for (const point of getAvailableMoves(before)) {
    assert.ok(outline.keys.includes(tileKey(point)));
    assert.ok(contains(outline.points, hexPosition(point.q, point.r)));
  }
  assert.equal((outline.path.match(/M/g) ?? []).length, 1);
  const fullHexArea = 3 * Math.sqrt(3) / 2 * 150 ** 2 * 0.7;
  assert.ok(Math.abs(area(outline.points) - 94 * fullHexArea) < 0.1);
});

test('after choosing an outer cake only its land remains through repeated returns', () => {
  let state = move(eveAtEdge(), { q: 6, r: 0 });
  const birthday = sceneApi.buildIslandOutline(state);
  assert.equal(birthday.keys.length, 92);
  assert.ok(birthday.keys.includes('6,0'));
  assert.ok(!birthday.keys.includes('6,-1') && !birthday.keys.includes('5,1'));
  assert.ok(contains(birthday.points, hexPosition(6, 0)));
  assert.ok(!contains(birthday.points, hexPosition(6, -1)));
  for (const point of [{ q: 5, r: 0 }, { q: 6, r: 0 }, { q: 5, r: 0 }]) {
    state = move(state, point);
    assert.deepEqual(sceneApi.buildIslandOutline(state), birthday);
  }
  assert.equal(sceneApi.buildIslandOutline(move(eveAtEdge(), { q: 5, r: -1 })).keys.length, 91);
});

test('all coastal layers and the terrain clip update to the same island outline', () => {
  const node = () => ({ attributes: new Map(), setAttribute(name, value) { this.attributes.set(name, value); } });
  const scene = Object.create(sceneApi.ExplorationScene.prototype);
  scene.islandClip = node();
  scene.shorePaths = [node(), node(), node(), node()];
  const eve = eveAtEdge();
  scene.paintIsland(eve);
  const expanded = scene.islandClip.attributes.get('d');
  assert.equal(expanded, sceneApi.buildIslandOutline(eve).path);
  assert.ok(scene.shorePaths.every((path) => path.attributes.get('d') === expanded));
  const birthday = move(eve, { q: 6, r: 0 });
  scene.paintIsland(birthday);
  const contracted = scene.islandClip.attributes.get('d');
  assert.notEqual(contracted, expanded);
  assert.ok(scene.shorePaths.every((path) => path.attributes.get('d') === contracted));
});

function createScene(t) {
  const originals = new Map(['document', 'matchMedia', 'ResizeObserver'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const element = (tag) => ({
    tag, attributes: new Map(), children: [], style: {}, dataset: {}, listeners: new Map(),
    classList: { add() {}, remove() {}, toggle() {} },
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    addEventListener(type, callback) { this.listeners.set(type, callback); },
  });
  globalThis.document = { createElementNS: (_, tag) => element(tag) };
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.ResizeObserver = class { observe() {} };
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const container = { append() {}, getBoundingClientRect: () => ({ width: 1000, height: 600 }) };
  return new sceneApi.ExplorationScene(container, { onMove() {}, onInspect() {} });
}

test('the flat meadow keeps the existing island extent, fog clipping, and missing-image fallback', (t) => {
  const scene = createScene(t);
  assert.equal(scene.landSurface.attributes.get('clip-path'), 'url(#island-clip)');
  assert.equal(scene.fogLayer.attributes.get('clip-path'), 'url(#island-clip)');
  const texture = scene.landSurface.children.find((node) => node.tag === 'image');
  assert.equal(texture.attributes.has('href'), false);
  assert.equal(texture.attributes.get('data-src'), './assets/map/terrain/flat-meadow-g.webp');
  assert.equal(texture.attributes.get('class'), 'flat-meadow-terrain');
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => texture.attributes.get(name)), ['-1770', '-1180', '3540', '2360']);
  assert.equal(texture.attributes.get('preserveAspectRatio'), 'xMidYMax meet');
  texture.listeners.get('error')();
  assert.equal(texture.style.display, 'none');
  assert.ok(scene.landSurface.children.some((node) => node.tag === 'rect' && node.attributes.get('fill') === 'url(#island-grass)'));
  assert.equal(scene.shorePaths.length, 6);
  assert.ok(scene.shorePaths.every((path) => path.attributes.get('d') === scene.islandClip.attributes.get('d')));
});

test('the school stages lightweight artwork with the existing size and ground anchor', (t) => {
  const scene = createScene(t);
  const school = scene.tiles.get('0,0');
  assert.equal(school.tile.id, 'school');
  assert.equal(school.model.attributes.get('transform'), 'translate(0 0)');
  const image = school.modelArt.children.find(node => node.tag === 'image');
  assert.equal(image.attributes.has('href'), false);
  assert.equal(image.attributes.get('data-src'), './assets/map/school.webp');
  assert.deepEqual(['x', 'y', 'width', 'height'].map(name => image.attributes.get(name)), ['-145', '-183', '290', '207']);
  assert.equal(image.attributes.get('preserveAspectRatio'), 'xMidYMax meet');
});

test('ordinary cells use the continuous meadow without raised props while memories and villages keep their models', (t) => {
  const scene = createScene(t);
  for (const [key, tile] of scene.tiles) {
    if (tile.tile.isMemory || tile.tile.isVillage) {
      assert.ok(tile.modelArt.children.length > 1, `special model missing at ${key}`);
      assert.ok(tile.memoryButton, `special label missing at ${key}`);
    } else {
      assert.equal(tile.modelArt.children.length, 0, `ordinary cell ${key} still has a raised prop`);
      assert.equal(tile.memoryButton, null);
    }
  }
});
