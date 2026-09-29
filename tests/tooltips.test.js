import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const cssHook = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('/tooltips.css')) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { installTooltips } = await import('../src/tooltips.js');
cssHook.deregister();

function setup(t, { modal = false, rect = { left: 270, top: 10, width: 44, height: 44 } } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const observers = [];
  let doc;
  class Target {
    listeners = new Map();
    addEventListener(type, callback, options) {
      const list = this.listeners.get(type) ?? [];
      list.push({ callback, capture: options === true || options?.capture === true });
      this.listeners.set(type, list);
    }
    removeEventListener(type, callback) {
      this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item.callback !== callback));
    }
  }
  class Element extends Target {
    constructor(tag) {
      super();
      this.tagName = tag.toUpperCase();
      this.ownerDocument = doc;
      this.children = [];
      this.parentNode = null;
      this.attrs = new Map();
      this.style = {};
      this.dataset = {};
      this.hidden = false;
      this.disabled = false;
      this.classes = new Set();
      this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
      this.rect = { left: 0, top: 0, width: 220, height: 82 };
    }
    get isConnected() { return this === doc.body || Boolean(this.parentNode?.isConnected); }
    append(...nodes) {
      for (const node of nodes) {
        node.remove();
        node.parentNode = this;
        this.children.push(node);
      }
    }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this);
      this.parentNode = null;
    }
    setAttribute(key, value) { this.attrs.set(key, String(value)); }
    getAttribute(key) { return this.attrs.get(key) ?? null; }
    hasAttribute(key) { return this.attrs.has(key); }
    removeAttribute(key) { this.attrs.delete(key); }
    matches(selector) { return selector === `#${this.id}` || (selector === 'dialog[open]' && this.tagName === 'DIALOG' && this.open); }
    querySelectorAll(selector) { return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]); }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
    contains(target) { return target === this || this.children.some(child => child.contains(target)); }
    getBoundingClientRect() { return { ...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height }; }
    showPopover() { this.popoverOpen = true; }
    hidePopover() { this.popoverOpen = false; }
  }
  const view = new Target();
  view.innerWidth = 320;
  view.innerHeight = 480;
  view.MutationObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  doc = new Target();
  doc.defaultView = view;
  doc.createElement = tag => new Element(tag);
  doc.body = doc.createElement('body');
  doc.querySelectorAll = selector => doc.body.querySelectorAll(selector);
  const button = doc.createElement('button');
  button.id = 'control';
  button.rect = rect;
  button.setAttribute('title', '旧原生提示');
  button.setAttribute('aria-describedby', 'existing-help');
  const dialog = modal ? doc.createElement('dialog') : null;
  if (dialog) { dialog.open = true; doc.body.append(dialog); dialog.append(button); }
  else doc.body.append(button);
  let enabled = false;
  const cleanup = installTooltips(doc, [{ selector: '#control', title: '声音', description: () => enabled ? '关闭音乐和音效。' : '开启音乐和音效。' }]);
  t.after(cleanup);
  const tooltip = doc.body.children.find(node => node.getAttribute('role') === 'tooltip');

  function emit(target, type, details = {}) {
    const event = {
      target, type, pointerId: 1, pointerType: 'mouse', clientX: 292, clientY: 30, button: 0, detail: 1,
      defaultPrevented: false, propagationStopped: false, immediateStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
      stopImmediatePropagation() { this.immediateStopped = true; this.propagationStopped = true; },
      ...details,
    };
    const ancestors = [];
    for (let node = target.parentNode; node; node = node.parentNode) ancestors.push(node);
    if (target !== doc && target !== view) ancestors.push(doc);
    const invoke = (node, capture) => {
      for (const listener of node.listeners.get(type) ?? []) {
        if (listener.capture === capture) listener.callback(event);
        if (event.immediateStopped) break;
      }
    };
    for (const node of [...ancestors].reverse()) { invoke(node, true); if (event.propagationStopped) return event; }
    invoke(target, true);
    if (!event.immediateStopped) invoke(target, false);
    if (!event.propagationStopped) for (const node of ancestors) { invoke(node, false); if (event.propagationStopped) break; }
    return event;
  }
  return { button, tooltip, dialog, doc, view, cleanup, observers, emit, enable: () => { enabled = true; } };
}

test('hover shows title and current description within the viewport, without a native title', t => {
  const dom = setup(t);
  assert.equal(dom.button.hasAttribute('title'), false);
  dom.emit(dom.button, 'pointerenter');
  assert.equal(dom.tooltip.hidden, false);
  assert.equal(dom.tooltip.popoverOpen, true);
  assert.equal(dom.tooltip.children[0].textContent, '声音');
  assert.equal(dom.tooltip.children[1].textContent, '开启音乐和音效。');
  assert.equal(dom.tooltip.style.left, '88px');
  assert.equal(dom.tooltip.style.top, '64px');
  assert.equal(dom.button.getAttribute('aria-describedby'), `existing-help ${dom.tooltip.id}`);
  dom.emit(dom.button, 'pointerleave');
  assert.equal(dom.tooltip.hidden, true);
  assert.equal(dom.button.getAttribute('aria-describedby'), 'existing-help');
  dom.enable();
  dom.emit(dom.button, 'pointerenter');
  assert.equal(dom.tooltip.children[1].textContent, '关闭音乐和音效。');
});

test('keyboard focus is described and Escape dismisses the tooltip before the dialog', t => {
  const dom = setup(t, { modal: true, rect: { left: 10, top: 410, width: 44, height: 44 } });
  dom.emit(dom.button, 'focusin');
  assert.equal(dom.tooltip.parentNode, dom.dialog);
  assert.equal(dom.tooltip.style.left, '12px');
  assert.equal(dom.tooltip.style.top, '318px');
  const escape = dom.emit(dom.button, 'keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(dom.tooltip.hidden, true);
  dom.emit(dom.button, 'focusin');
  dom.emit(dom.button, 'focusout');
  assert.equal(dom.tooltip.hidden, true);
});

test('touch hold shows at 450 ms, suppresses only its click, and stays readable after release', t => {
  const dom = setup(t);
  let actions = 0;
  dom.button.addEventListener('click', () => { actions++; });
  dom.emit(dom.button, 'pointerdown', { pointerType: 'touch' });
  dom.emit(dom.button, 'focusin');
  t.mock.timers.tick(449);
  assert.equal(dom.tooltip.hidden, true);
  t.mock.timers.tick(1);
  assert.equal(dom.tooltip.hidden, false);
  dom.emit(dom.button, 'pointerup', { pointerType: 'touch' });
  dom.emit(dom.button, 'pointerleave', { pointerType: 'touch' });
  const click = dom.emit(dom.button, 'click', { pointerType: 'touch' });
  assert.equal(click.defaultPrevented, true);
  assert.equal(actions, 0);
  t.mock.timers.tick(2399);
  assert.equal(dom.tooltip.hidden, false);
  t.mock.timers.tick(1);
  assert.equal(dom.tooltip.hidden, true);
  dom.emit(dom.button, 'pointerdown', { pointerType: 'touch' });
  dom.emit(dom.button, 'pointerup', { pointerType: 'touch' });
  dom.emit(dom.button, 'click', { pointerType: 'touch' });
  assert.equal(actions, 1);
});

test('a short touch tap works normally and a drag never gets prevented or opens a tooltip', t => {
  const dom = setup(t);
  let actions = 0;
  dom.button.addEventListener('click', () => { actions++; });
  dom.emit(dom.button, 'pointerdown', { pointerType: 'touch' });
  t.mock.timers.tick(100);
  dom.emit(dom.button, 'pointerup', { pointerType: 'touch' });
  dom.emit(dom.button, 'click', { pointerType: 'touch' });
  assert.equal(actions, 1);
  dom.emit(dom.button, 'pointerdown', { pointerType: 'touch' });
  const move = dom.emit(dom.doc, 'pointermove', { pointerType: 'touch', clientX: 303 });
  assert.equal(move.defaultPrevented, false);
  t.mock.timers.tick(500);
  assert.equal(dom.tooltip.hidden, true);
});

test('cancelling a touch clears pending and displayed holds', t => {
  const dom = setup(t);
  dom.emit(dom.button, 'pointerdown', { pointerType: 'touch' });
  dom.emit(dom.button, 'pointercancel', { pointerType: 'touch' });
  t.mock.timers.tick(500);
  assert.equal(dom.tooltip.hidden, true);
  dom.emit(dom.button, 'pointerdown', { pointerType: 'touch' });
  t.mock.timers.tick(450);
  const context = dom.emit(dom.button, 'contextmenu', { pointerType: 'touch' });
  assert.equal(context.defaultPrevented, true);
  dom.emit(dom.button, 'pointercancel', { pointerType: 'touch' });
  assert.equal(dom.tooltip.hidden, true);
});

test('a new tap or keyboard activation works immediately after a held touch', t => {
  const dom = setup(t);
  let actions = 0;
  dom.button.addEventListener('click', () => { actions++; });
  dom.emit(dom.button, 'pointerdown', { pointerType: 'touch' });
  t.mock.timers.tick(450);
  dom.emit(dom.button, 'pointerup', { pointerType: 'touch' });
  dom.emit(dom.button, 'click', { detail: 0, pointerType: '' });
  assert.equal(actions, 1);
  dom.emit(dom.button, 'pointerdown', { pointerType: 'touch' });
  dom.emit(dom.button, 'pointerup', { pointerType: 'touch' });
  dom.emit(dom.button, 'click', { pointerType: 'touch' });
  assert.equal(actions, 2);
});

test('native titles updated by the app stay suppressed; cleanup restores them and removes its own ARIA id', t => {
  const dom = setup(t);
  dom.button.setAttribute('title', '新的原生提示');
  dom.observers[0].callback([{ target: dom.button, attributeName: 'title' }]);
  assert.equal(dom.button.hasAttribute('title'), false);
  dom.emit(dom.button, 'pointerenter');
  dom.button.setAttribute('aria-describedby', `${dom.button.getAttribute('aria-describedby')} later-help`);
  dom.cleanup();
  assert.equal(dom.button.getAttribute('title'), '新的原生提示');
  assert.equal(dom.button.getAttribute('aria-describedby'), 'existing-help later-help');
  assert.equal(dom.tooltip.isConnected, false);
  assert.equal(dom.observers[0].disconnected, true);
  dom.emit(dom.button, 'pointerenter');
  assert.equal(dom.tooltip.hidden, true);
});
