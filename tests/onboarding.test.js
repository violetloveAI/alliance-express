import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Load the real browser module; only its stylesheet is ignored by Node.
const stylesheetHook = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('/onboarding.css')) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
let createOnboarding;
let moduleError;
try { ({ createOnboarding } = await import('../src/onboarding.js')); } catch (error) { moduleError = error; }
stylesheetHook.deregister();

function installDOM(t) {
  assert.equal(moduleError, undefined, `The onboarding module must load: ${moduleError?.message}`);
  const original = new Map(['document', 'window'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = [];
  const doc = {};
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.dataset = {};
      this.attributes = new Map();
      this.listeners = new Map();
      this.open = false;
      this.hidden = false;
      this.disabled = false;
      this.textContent = '';
    }
    get isConnected() { return this === doc.body || Boolean(this.parentNode?.isConnected); }
    append(...nodes) { for (const node of nodes) { this.children.push(node); node.parentNode = this; } }
    replaceChildren(...nodes) { for (const node of this.children) node.parentNode = null; this.children = []; this.append(...nodes); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    addEventListener(type, callback) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(callback);
      this.listeners.set(type, listeners);
    }
    emit(type, details = {}) {
      const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...details };
      for (const callback of this.listeners.get(type) ?? []) callback(event);
      return event;
    }
    click() { if (!this.disabled) this.emit('click'); }
    focus() { doc.activeElement = this; }
    showModal() { this.open = true; }
    close() { if (this.open) { this.open = false; this.emit('close'); } }
  }
  doc.createElement = (tag) => new Element(tag);
  doc.body = new Element('body');
  doc.activeElement = doc.body;
  globalThis.document = doc;
  globalThis.window = { requestAnimationFrame: (callback) => frames.push(callback) };
  t.after(() => {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const nodes = (root = doc.body) => [root, ...root.children.flatMap((child) => nodes(child))];
  return {
    doc,
    byId: (id) => nodes().find((node) => node.id === id),
    buttons: () => nodes().filter((node) => node.tagName === 'BUTTON'),
    button: (action) => nodes().find((node) => node.dataset.onboardingAction === action),
    dialog: () => nodes().find((node) => node.tagName === 'DIALOG'),
    text: () => nodes().map((node) => node.textContent).join(' '),
    flushFocus: () => { while (frames.length) frames.shift()(); },
  };
}

test('a fresh start hides the cover before calling onStart and ignores a repeated stale click', (t) => {
  const dom = installDOM(t);
  let calls = 0;
  let startButton;
  const onboarding = createOnboarding({
    onStart() { calls += 1; assert.equal(onboarding.isOpen(), false); startButton.click(); },
  });
  onboarding.showStart();
  assert.equal(onboarding.isOpen(), true);
  startButton = dom.button('start');
  assert.ok(startButton);
  assert.equal(startButton.textContent, '出发');
  assert.deepEqual(dom.buttons(), [startButton]);
  startButton.click();
  assert.equal(calls, 1);
});

test('every cover opening offers only departure and rejects clicks from an earlier cover', (t) => {
  const dom = installDOM(t);
  let started = 0;
  const onboarding = createOnboarding({ onStart: () => started++ });
  onboarding.showStart();
  const firstDeparture = dom.button('start');
  firstDeparture.click();
  assert.equal(started, 1);
  onboarding.showStart();
  const nextDeparture = dom.button('start');
  assert.equal(nextDeparture.textContent, '出发');
  assert.deepEqual(dom.buttons(), [nextDeparture]);
  assert.match(dom.text(), /每次见面，都是一次新的漫游。/);
  assert.doesNotMatch(dom.text(), /保存|继续漫游|重新出发/);
  firstDeparture.click();
  assert.equal(started, 1);
  assert.equal(onboarding.isOpen(), true);
  nextDeparture.click();
  assert.equal(started, 2);
  assert.equal(onboarding.isOpen(), false);
});

test('the only departure button receives focus and the cover has an accessible title', (t) => {
  const dom = installDOM(t);
  const onboarding = createOnboarding();
  onboarding.showStart();
  assert.equal(dom.doc.activeElement, dom.button('start'));
  const title = dom.byId(dom.dialog().getAttribute('aria-labelledby'));
  assert.ok(title);
  assert.equal(title.getAttribute('aria-label'), '同盟漫游记');
  assert.match(dom.text(), /2026年10月/);
});

test('Escape cannot bypass the start screen or invoke a business callback', (t) => {
  const dom = installDOM(t);
  let calls = 0;
  const onboarding = createOnboarding({ onStart: () => calls++, onTutorialComplete: () => calls++ });
  onboarding.showStart();
  const event = dom.dialog().emit('cancel');
  assert.equal(event.defaultPrevented, true);
  assert.equal(onboarding.isOpen(), true);
  assert.equal(calls, 0);
});

for (const action of ['complete', 'skip', 'escape', 'native-close', 'backdrop']) {
  test(`tutorial ${action} completes exactly once and hides before the callback`, (t) => {
    const dom = installDOM(t);
    let completed = 0;
    const onboarding = createOnboarding({
      onTutorialComplete() { completed++; assert.equal(onboarding.isOpen(), false); onboarding.hide(); },
    });
    onboarding.showTutorial();
    const staleComplete = dom.button('complete');
    if (action === 'escape') dom.dialog().emit('cancel');
    else if (action === 'native-close') dom.dialog().close();
    else if (action === 'backdrop') {
      dom.dialog().emit('pointerdown');
      dom.dialog().emit('click');
    } else dom.button(action).click();
    staleComplete.click();
    assert.equal(completed, 1);
    assert.equal(onboarding.isOpen(), false);
  });
}

test('hide is a pure dismissal and restores the original focus', (t) => {
  const dom = installDOM(t);
  const opener = dom.doc.createElement('button');
  dom.doc.body.append(opener);
  opener.focus();
  let completed = 0;
  const onboarding = createOnboarding({ onTutorialComplete: () => completed++ });
  onboarding.showTutorial();
  onboarding.hide();
  dom.flushFocus();
  assert.equal(completed, 0);
  assert.equal(dom.doc.activeElement, opener);
});

test('starting directly into the tutorial keeps tutorial focus and completes once per showing', (t) => {
  const dom = installDOM(t);
  let completed = 0;
  const onboarding = createOnboarding({
    onStart: () => onboarding.showTutorial(),
    onTutorialComplete: () => completed++,
  });
  onboarding.showStart();
  dom.button('start').click();
  dom.flushFocus();
  assert.equal(onboarding.isOpen(), true);
  assert.equal(dom.doc.activeElement, dom.button('complete'));
  dom.button('complete').click();
  onboarding.showTutorial();
  dom.button('skip').click();
  assert.equal(completed, 2);
});
