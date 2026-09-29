import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoadingScreen } from '../src/loading-screen.js';

function screen(t, reduced = false) {
  const keys = ['document', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const nodes = new Map();
  const frames = new Map();
  let id = 0, time = 0;
  for (const name of ['boot-loader', 'boot-progress', 'boot-percent', 'boot-fill', 'boot-caption', 'boot-status', 'boot-retry', 'app']) {
    const attributes = new Map(), classes = new Set();
    nodes.set(`#${name}`, { hidden: false, style: {}, textContent: '', inert: false,
      setAttribute: (key, value) => attributes.set(key, value), getAttribute: key => attributes.get(key),
      removeAttribute: key => attributes.delete(key), focus() {},
      classList: { add: (...values) => values.forEach(value => classes.add(value)),
        remove: (...values) => values.forEach(value => classes.delete(value)), contains: value => classes.has(value) },
    });
  }
  globalThis.document = { querySelector: key => nodes.get(key) };
  globalThis.matchMedia = () => ({ matches: reduced });
  globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = frame => frames.delete(frame);
  t.after(() => { for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } });
  return { node: name => nodes.get(`#${name}`), flush() {
    for (let guard = 0; frames.size && guard < 150; guard++) {
      const pending = [...frames.values()]; frames.clear(); time += 16; pending.forEach(callback => callback(time));
    }
    assert.equal(frames.size, 0, 'progress animation must settle when resources stop arriving');
  } };
}

test('visible progress stays at verified integer readiness and never runs backwards', t => {
  const dom = screen(t), loader = createLoadingScreen();
  loader.show();
  assert.equal(dom.node('boot-percent').textContent, '1%');
  loader.update(47.8); dom.flush();
  assert.equal(dom.node('boot-percent').textContent, '47%');
  assert.equal(dom.node('boot-progress').getAttribute('aria-valuenow'), '47');
  loader.update(12); dom.flush();
  assert.equal(dom.node('boot-percent').textContent, '47%');
  assert.equal(dom.node('app').inert, true);
});

test('completion reaches 100 and releases the screen and keyboard gate with reduced motion', async t => {
  const dom = screen(t, true), loader = createLoadingScreen();
  loader.show();
  await loader.finish();
  assert.equal(dom.node('boot-percent').textContent, '100%');
  assert.equal(dom.node('boot-loader').hidden, true);
  assert.equal(dom.node('app').inert, false);
  assert.equal(dom.node('app').getAttribute('aria-hidden'), undefined);
});

test('failure stops pending progress and exposes retry without opening the game', t => {
  const dom = screen(t), loader = createLoadingScreen();
  loader.show(); loader.update(99); loader.error(); dom.flush();
  assert.equal(dom.node('boot-percent').textContent, '1%');
  assert.equal(dom.node('boot-retry').hidden, false);
  assert.equal(dom.node('app').inert, true);
});

test('a superseded loading screen cannot hide a newer journey or release its keyboard gate', async t => {
  const dom = screen(t, true), old = createLoadingScreen(), current = createLoadingScreen();
  old.show();
  const oldFinish = old.finish();
  current.show();
  await oldFinish;
  assert.equal(dom.node('boot-loader').hidden, false);
  assert.equal(dom.node('app').inert, true);
  assert.equal(dom.node('boot-percent').textContent, '1%');
});
