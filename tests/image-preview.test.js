import test from 'node:test';
import assert from 'node:assert/strict';

let createImagePreview;
let moduleError;
try { ({ createImagePreview } = await import('../src/image-preview.js')); } catch (error) { moduleError = error; }

function installDOM(t) {
  assert.equal(moduleError, undefined, `Image preview must load: ${moduleError?.message}`);
  const originals = new Map(['document', 'window'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = [];
  const closeEvents = [];
  const doc = {};
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attrs = new Map();
      this.listeners = new Map();
      this.open = false;
      this.textContent = '';
      this.disabled = false;
    }
    get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
    get className() { return this.attrs.get('class') ?? ''; }
    set className(value) { this.setAttribute('class', value); }
    get classList() { return { contains: (value) => this.className.split(/\s+/).includes(value) }; }
    get src() { return this.attrs.get('src') ?? ''; }
    set src(value) { this.setAttribute('src', value); }
    get alt() { return this.attrs.get('alt') ?? ''; }
    set alt(value) { this.setAttribute('alt', value); }
    get id() { return this.attrs.get('id') ?? ''; }
    set id(value) { this.setAttribute('id', value); }
    get isConnected() { return this === doc.body || Boolean(this.parentNode?.isConnected); }
    setAttribute(key, value) { this.attrs.set(key, String(value)); }
    getAttribute(key) { return this.attrs.get(key) ?? null; }
    removeAttribute(key) { this.attrs.delete(key); }
    append(...nodes) { for (const node of nodes) { this.children.push(node); node.parentNode = this; } }
    replaceChildren(...nodes) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...nodes); }
    querySelectorAll(selector) {
      return this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]).filter((child) => selector === '*' || child.tagName.toLowerCase() === selector);
    }
    cloneNode(deep) {
      const clone = new Element(this.tagName);
      for (const [name, value] of this.attrs) clone.setAttribute(name, value);
      clone.textContent = this.textContent;
      if (deep) clone.append(...this.children.map((child) => child.cloneNode(true)));
      return clone;
    }
    addEventListener(type, callback) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(callback);
      this.listeners.set(type, listeners);
    }
    emit(type, details = {}) {
      const event = { target: this, defaultPrevented: false, propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...details };
      for (const callback of this.listeners.get(type) ?? []) callback(event);
      return event;
    }
    click() { if (!this.disabled) this.emit('click'); }
    focus(options) { doc.activeElement = this; this.focusOptions = options; }
    showModal() { this.open = true; }
    close() { if (this.open) { this.open = false; closeEvents.push(() => this.emit('close')); } }
  }
  doc.createElement = (tag) => new Element(tag);
  doc.createElementNS = (_namespace, tag) => new Element(tag);
  doc.body = new Element('body');
  doc.activeElement = doc.body;
  globalThis.document = doc;
  globalThis.window = { requestAnimationFrame: (callback) => frames.push(callback) };
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const nodes = () => [doc.body, ...doc.body.querySelectorAll('*')];
  const byClass = (name) => nodes().find((element) => element.classList.contains(name));
  return {
    doc, byClass,
    dialog: () => byClass('image-preview'),
    surface: () => byClass('image-preview__surface'),
    button: () => byClass('image-preview__close'),
    picture() {
      const image = doc.createElement('img');
      image.id = 'original-photo'; image.src = '/assets/photo.webp'; image.alt = '一起走过的小路';
      image.setAttribute('loading', 'lazy');
      doc.body.append(image);
      return image;
    },
    flushClose() { while (closeEvents.length) closeEvents.shift()(); },
    flushFocus() { while (frames.length) frames.shift()(); },
  };
}

test('opening clones a full image without changing its source or closing the parent dialog', (t) => {
  const dom = installDOM(t);
  const parent = dom.doc.createElement('dialog'); dom.doc.body.append(parent); parent.showModal();
  const source = dom.picture(); source.setAttribute('style', 'transform:rotate(4deg)');
  const preview = createImagePreview();
  preview.open(source, { label: '旅行照片', trigger: source });
  const clone = dom.surface().children[0];
  assert.notEqual(clone, source);
  assert.equal(clone.src, source.src);
  assert.equal(clone.id, '');
  assert.equal(clone.loading, 'eager');
  assert.equal(clone.getAttribute('style'), null);
  assert.equal(source.getAttribute('loading'), 'lazy');
  assert.equal(source.getAttribute('style'), 'transform:rotate(4deg)');
  assert.equal(parent.open, true);
  assert.equal(preview.isOpen(), true);
  assert.equal(dom.doc.activeElement, dom.button());
  assert.equal(dom.byClass('image-preview__title').textContent, '旅行照片');
});

for (const route of ['surface', 'button', 'escape', 'native', 'backdrop']) {
  test(`${route} dismissal clears cloned sources, preserves original art and restores trigger focus`, (t) => {
    const dom = installDOM(t);
    const source = dom.picture();
    const trigger = dom.doc.createElement('button'); dom.doc.body.append(trigger); trigger.focus();
    const preview = createImagePreview(); preview.open(source, { trigger });
    const clone = dom.surface().children[0];
    if (route === 'surface') dom.surface().emit('click', { target: clone });
    else if (route === 'button') dom.button().click();
    else if (route === 'escape') assert.equal(dom.dialog().emit('cancel').defaultPrevented, true);
    else if (route === 'native') dom.dialog().close();
    else dom.dialog().emit('click');
    dom.flushClose(); dom.flushFocus();
    assert.equal(preview.isOpen(), false);
    assert.equal(dom.surface().children.length, 0);
    assert.equal(clone.getAttribute('src'), null);
    assert.equal(source.src, '/assets/photo.webp');
    assert.equal(dom.doc.activeElement, trigger);
    assert.deepEqual(trigger.focusOptions, { preventScroll: true });
  });
}

test('a queued native close or focus restoration cannot clear or refocus a reopened preview', (t) => {
  const dom = installDOM(t);
  const source = dom.picture();
  const trigger = dom.doc.createElement('button'); dom.doc.body.append(trigger);
  const preview = createImagePreview();
  preview.open(source, { trigger });
  preview.close();
  preview.open(source, { label: '第二次打开', trigger });
  const currentClone = dom.surface().children[0];
  dom.flushClose(); dom.flushFocus();
  assert.equal(preview.isOpen(), true);
  assert.equal(dom.surface().children[0], currentClone);
  assert.equal(currentClone.src, source.src);
  assert.equal(dom.doc.activeElement, dom.button());
});

test('silent reset dismissal and removed triggers do not steal focus', (t) => {
  const dom = installDOM(t);
  const source = dom.picture();
  const trigger = dom.doc.createElement('button'); dom.doc.body.append(trigger);
  const other = dom.doc.createElement('button'); dom.doc.body.append(other);
  const preview = createImagePreview();
  preview.open(source, { trigger });
  preview.close({ restoreFocus: false });
  other.focus(); dom.flushClose(); dom.flushFocus();
  assert.equal(dom.doc.activeElement, other);
  preview.open(source, { trigger });
  trigger.parentNode = null;
  preview.close(); other.focus(); dom.flushClose(); dom.flushFocus();
  assert.equal(dom.doc.activeElement, other);
});

test('replacing an open preview clears the previous clone while retaining its original focus target', (t) => {
  const dom = installDOM(t);
  const source = dom.picture(); const next = dom.picture(); next.src = '/second.webp';
  const trigger = dom.doc.createElement('button'); dom.doc.body.append(trigger);
  const preview = createImagePreview(); preview.open(source, { trigger });
  const previousClone = dom.surface().children[0];
  preview.open(next);
  assert.equal(previousClone.getAttribute('src'), null);
  assert.equal(dom.surface().children[0].src, '/second.webp');
  preview.close(); dom.flushClose(); dom.flushFocus();
  assert.equal(dom.doc.activeElement, trigger);
});

test('hero compositions preserve portraits, captions and SVG references while stripping interactivity', (t) => {
  const dom = installDOM(t);
  const gallery = dom.doc.createElement('div'); gallery.className = 'hero-gallery hero-gallery--alliance'; gallery.id = 'original-gallery';
  gallery.setAttribute('role', 'button'); gallery.setAttribute('tabindex', '0'); gallery.setAttribute('onclick', 'oldAction()');
  const svg = dom.doc.createElement('svg'); svg.className = 'game-scenery'; svg.setAttribute('viewBox', '0 0 480 330');
  const gradient = dom.doc.createElement('linearGradient'); gradient.id = 'landscape-color';
  const shape = dom.doc.createElement('path'); shape.setAttribute('fill', 'url(#landscape-color)');
  svg.append(gradient, shape); gallery.append(svg);
  for (const name of ['Water Sheep', 'Violet']) {
    const figure = dom.doc.createElement('figure'); const portrait = dom.doc.createElement('img'); portrait.src = `/${name}.webp`; portrait.setAttribute('loading', 'lazy');
    const caption = dom.doc.createElement('figcaption'); caption.textContent = name; figure.append(portrait, caption); gallery.append(figure);
  }
  const link = dom.doc.createElement('a'); link.setAttribute('href', '/old-link'); link.setAttribute('tabindex', '0'); gallery.append(link);
  dom.doc.body.append(gallery);
  const preview = createImagePreview(); preview.open(gallery);
  const clone = dom.surface().children[0];
  assert.equal(clone.id, '');
  assert.equal(clone.getAttribute('role'), null);
  assert.equal(clone.getAttribute('tabindex'), null);
  assert.equal(clone.getAttribute('onclick'), null);
  assert.equal(clone.querySelectorAll('a')[0].getAttribute('href'), null);
  assert.deepEqual(clone.querySelectorAll('figcaption').map((caption) => caption.textContent), ['Water Sheep', 'Violet']);
  assert.equal(clone.querySelectorAll('svg')[0].getAttribute('viewBox'), '0 0 480 330');
  const clonedGradient = clone.querySelectorAll('lineargradient')[0];
  assert.notEqual(clonedGradient.id, gradient.id);
  assert.equal(clone.querySelectorAll('path')[0].getAttribute('fill'), `url(#${clonedGradient.id})`);
  assert.equal(shape.getAttribute('fill'), 'url(#landscape-color)');
  assert.ok(clone.querySelectorAll('img').every((image) => image.loading === 'eager'));
  assert.equal(dom.dialog().emit('keydown', { key: 'ArrowRight' }).propagationStopped, true);
  assert.equal(dom.dialog().emit('keyup', { key: 'ArrowRight' }).propagationStopped, true);
});
