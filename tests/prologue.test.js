import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

let createPrologue;
let createOnboarding;
let moduleError;
const stylesheetHook = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('/onboarding.css')) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
try {
  ({ createPrologue } = await import('../src/prologue.js'));
  ({ createOnboarding } = await import('../src/onboarding.js'));
} catch (error) { moduleError = error; }
stylesheetHook.deregister();

function installDOM(t, { reducedMotion = false } = {}) {
  assert.equal(moduleError, undefined, `The prologue module must load: ${moduleError?.message}`);
  const originals = new Map(['document', 'window'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = [];
  const timers = new Map();
  let now = 0;
  let timerId = 0;
  const doc = { hidden: false };
  class EventTarget {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, callback) {
      const listeners = this.listeners.get(type) ?? new Set();
      listeners.add(callback);
      this.listeners.set(type, listeners);
    }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    emit(type, details = {}) {
      const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...details };
      for (const callback of this.listeners.get(type) ?? []) callback(event);
      return event;
    }
  }
  const docEvents = new EventTarget();
  doc.addEventListener = docEvents.addEventListener.bind(docEvents);
  doc.removeEventListener = docEvents.removeEventListener.bind(docEvents);
  class Element extends EventTarget {
    constructor(tag) {
      super();
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.dataset = {};
      this.attributes = new Map();
      this.open = false;
      this.hidden = false;
      this.disabled = false;
      this.complete = false;
      this.naturalWidth = 0;
      this.textContent = '';
    }
    get isConnected() { return this === doc.body || Boolean(this.parentNode?.isConnected); }
    append(...nodes) { for (const node of nodes) { this.children.push(node); node.parentNode = this; } }
    replaceChildren(...nodes) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...nodes); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    click() { if (!this.disabled) this.emit('click'); }
    focus() { doc.activeElement = this; }
    showModal() { this.open = true; }
    close() { if (this.open) { this.open = false; this.emit('close'); } }
  }
  doc.createElement = (tag) => new Element(tag);
  doc.body = new Element('body');
  doc.activeElement = doc.body;
  globalThis.document = doc;
  globalThis.window = {
    performance: { now: () => now },
    matchMedia: () => ({ matches: reducedMotion }),
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout(callback, delay) { timers.set(++timerId, { callback, at: now + delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  };
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const nodes = (root = doc.body) => [root, ...root.children.flatMap((child) => nodes(child))];
  const slides = () => nodes().filter((node) => node.className === 'prologue__slide');
  const images = () => nodes().filter((node) => node.className === 'prologue__image');
  return {
    doc, timers,
    dialog: () => nodes().find((node) => node.className === 'prologue'),
    button: (action) => nodes().find((node) => node.dataset.prologueAction === action),
    tutorialButton: (action) => nodes().find((node) => node.dataset.onboardingAction === action),
    current: () => slides().findIndex((slide) => !slide.hidden),
    images,
    settle(index, success = true) {
      const image = images()[index];
      image.complete = true;
      image.naturalWidth = success ? 640 : 0;
      image.emit(success ? 'load' : 'error');
    },
    settleAll() { images().forEach((image) => { image.complete = true; image.naturalWidth = 640; image.emit('load'); }); },
    setHidden(hidden) { doc.hidden = hidden; docEvents.emit('visibilitychange'); },
    tick(duration) {
      const end = now + duration;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = end;
    },
    flushFocus() { while (frames.length) frames.shift()(); },
  };
}

test('autoplay waits for each picture and finishes exactly once after all four pages', (t) => {
  const dom = installDOM(t);
  let completed = 0;
  const prologue = createPrologue({ onComplete: () => { completed++; assert.equal(prologue.isOpen(), false); } });
  prologue.show();
  assert.equal(dom.current(), 0);
  dom.tick(20000);
  assert.equal(dom.current(), 0);
  dom.settle(0);
  dom.tick(5499);
  assert.equal(dom.current(), 0);
  dom.tick(1);
  assert.equal(dom.current(), 1);
  dom.tick(20000);
  assert.equal(dom.current(), 1);
  dom.settleAll();
  dom.tick(5500 * 3);
  assert.equal(completed, 1);
  dom.button('skip').click();
  dom.tick(50000);
  assert.equal(completed, 1);
});

test('pause and tab visibility preserve the remaining reading time', (t) => {
  const dom = installDOM(t);
  const prologue = createPrologue();
  prologue.show();
  dom.settleAll();
  dom.tick(2000);
  dom.button('pause').click();
  assert.equal(dom.dialog().dataset.playback, 'paused');
  dom.tick(10000);
  assert.equal(dom.current(), 0);
  dom.button('pause').click();
  dom.tick(1000);
  dom.setHidden(true);
  dom.tick(30000);
  assert.equal(dom.current(), 0);
  dom.setHidden(false);
  dom.tick(2499);
  assert.equal(dom.current(), 0);
  dom.tick(1);
  assert.equal(dom.current(), 1);
});

test('reduced motion starts in manual mode and can explicitly opt into autoplay', (t) => {
  const dom = installDOM(t, { reducedMotion: true });
  const prologue = createPrologue();
  prologue.show();
  dom.settleAll();
  dom.tick(50000);
  assert.equal(dom.current(), 0);
  assert.equal(dom.dialog().dataset.playback, 'paused');
  dom.button('next').click();
  assert.equal(dom.current(), 1);
  dom.button('pause').click();
  dom.tick(5500);
  assert.equal(dom.current(), 2);
});

test('manual navigation resets reading time without replacing or moving focused controls', (t) => {
  const dom = installDOM(t);
  const prologue = createPrologue();
  prologue.show();
  dom.settleAll();
  const next = dom.button('next');
  next.focus();
  dom.tick(5000);
  next.click();
  dom.tick(500);
  assert.equal(dom.current(), 1);
  assert.equal(dom.doc.activeElement, next);
  assert.equal(dom.button('next'), next);
  dom.dialog().emit('keydown', { key: 'ArrowLeft' });
  assert.equal(dom.current(), 0);
  dom.button('page-3').click();
  assert.equal(dom.current(), 3);
  assert.equal(dom.button('page-3').getAttribute('aria-current'), 'step');
});

for (const action of ['skip', 'escape', 'native-close']) {
  test(`${action} finishes once, and a repeated show rejects an earlier timer callback`, (t) => {
    const dom = installDOM(t);
    let completed = 0;
    const prologue = createPrologue({ onComplete: () => completed++ });
    prologue.show();
    dom.settleAll();
    const staleTimer = [...dom.timers.values()][0].callback;
    if (action === 'escape') dom.dialog().emit('cancel');
    else if (action === 'native-close') dom.dialog().close();
    else dom.button('skip').click();
    assert.equal(completed, 1);
    assert.equal(prologue.isOpen(), false);
    prologue.show();
    staleTimer();
    assert.equal(dom.current(), 0);
    assert.equal(completed, 1);
    dom.tick(5500);
    assert.equal(dom.current(), 1);
    prologue.hide();
    dom.tick(50000);
    assert.equal(completed, 1);
  });
}

test('a failed illustration leaves a readable slide that can advance', (t) => {
  const dom = installDOM(t);
  const prologue = createPrologue({ baseUrl: '/journey/' });
  prologue.show();
  assert.equal(dom.images()[0].src, '/journey/assets/prologue/01-game.webp');
  dom.settle(0, false);
  assert.equal(dom.images()[0].hidden, true);
  dom.tick(5500);
  assert.equal(dom.current(), 1);
});

test('hiding cancels completion and restores focus only for a standalone dismissal', (t) => {
  const dom = installDOM(t);
  const opener = dom.doc.createElement('button');
  dom.doc.body.append(opener);
  opener.focus();
  let completed = 0;
  const prologue = createPrologue({ onComplete: () => completed++ });
  prologue.show();
  dom.settleAll();
  prologue.hide();
  dom.flushFocus();
  assert.equal(dom.doc.activeElement, opener);
  dom.tick(50000);
  assert.equal(completed, 0);
});

test('cover, prologue and tutorial integrate without a stale focus restoration or early arrival', (t) => {
  const dom = installDOM(t);
  let arrived = 0;
  const onboarding = createOnboarding({ onStart: () => onboarding.showPrologue(), onTutorialComplete: () => arrived++ });
  onboarding.showStart();
  dom.tutorialButton('start').click();
  assert.equal(onboarding.isOpen(), true);
  dom.flushFocus();
  assert.equal(dom.doc.activeElement, dom.button('next'));
  assert.equal(arrived, 0);
  dom.button('skip').click();
  dom.flushFocus();
  assert.equal(dom.doc.activeElement, dom.tutorialButton('complete'));
  assert.equal(onboarding.isOpen(), true);
  assert.equal(arrived, 0);
  dom.tutorialButton('complete').click();
  assert.equal(arrived, 1);
  assert.equal(onboarding.isOpen(), false);
});
