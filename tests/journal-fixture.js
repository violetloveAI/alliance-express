import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createInitialState, getNeighbors, move, MEMORY_TILES, tileKey } from '../src/exploration.js';

const cssHook = registerHooks({ load(url, context, nextLoad) {
  return url.endsWith('/photo-album.css') ? { format: 'module', source: '', shortCircuit: true } : nextLoad(url, context);
} });
export const { createJournal, getJournalPages } = await import('../src/journal.js');
export const { createPhotoAlbum } = await import('../src/photo-album.js');
cssHook.deregister();

export const descendants = root => [root, ...root.children.flatMap(descendants)];
export const memory = id => MEMORY_TILES.find(tile => tile.id === id);
export function pathTo(start, target) {
  const queue = [[start]], seen = new Set([tileKey(start)]);
  while (queue.length) {
    const path = queue.shift(), current = path.at(-1);
    if (tileKey(current) === tileKey(target)) return path.slice(1);
    for (const next of getNeighbors(current)) {
      if (seen.has(tileKey(next))) continue;
      seen.add(tileKey(next)); queue.push([...path, next]);
    }
  }
  throw new Error(`No path to ${tileKey(target)}`);
}
export function walkTo(state, target) {
  return pathTo(state.position, target).reduce((current, position) => move(current, position), state);
}
export function birthdayState() {
  let state = createInitialState();
  for (let step = 1; step <= 25; step++) state = move(state, memory(step % 2 ? 'canteen' : 'school'));
  return state;
}

export function installJournalDOM(t) {
  const originals = new Map(['document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const doc = {}, loads = [], frames = [];
  class Element {
    constructor(tag) {
      this.tagName = tag.toLowerCase(); this.children = []; this.dataset = {}; this.attrs = {}; this.listeners = new Map();
      this.className = ''; this.style = { setProperty() {} }; this.open = false; this.hidden = false; this.disabled = false;
      this.textContent = ''; this.scrollLeft = 0; this.scrollTop = 0;
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: name => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
        toggle: (name, enabled) => { this.className = this.className.split(/\s+/).filter(value => value !== name).concat(enabled ? [name] : []).join(' '); },
      };
    }
    get id() { return this.attrs.id ?? ''; }
    set id(value) { this.attrs.id = value; }
    get isConnected() { return this === doc.body || Boolean(this.parent?.isConnected); }
    get src() { return this.getAttribute('src'); }
    set src(value) { this.setAttribute('src', value); loads.push(value); }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    after(node) { assert.ok(this.parent); node.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, node); }
    replaceChildren(...nodes) { for (const child of this.children) child.parent = null; this.children = []; this.append(...nodes); }
    setAttribute(key, value) {
      this.attrs[key] = String(value);
      if (key === 'class') this.className = value;
      if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    getAttribute(key) { return this.attrs[key] ?? null; }
    removeAttribute(key) { delete this.attrs[key]; }
    contains(node) { return descendants(this).includes(node); }
    addEventListener(type, callback) { const callbacks = this.listeners.get(type) ?? []; callbacks.push(callback); this.listeners.set(type, callbacks); }
    emit(type, details = {}) {
      const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...details };
      for (const callback of this.listeners.get(type) ?? []) callback(event);
      return event;
    }
    click() { if (!this.disabled) this.emit('click'); }
    focus() { doc.activeElement = this; }
    showModal() { this.open = true; }
    close() { if (this.open) { this.open = false; this.emit('close'); } }
    scrollIntoView(options) { this.scrollRequests ??= []; this.scrollRequests.push({ options, modalOpen: doc.body.children.some(node => node.open) }); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    querySelectorAll(selector) {
      return descendants(this).slice(1).filter(node => {
        if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
        if (selector.startsWith('#')) return node.id === selector.slice(1);
        const attr = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
        if (attr) {
          const value = attr[1].startsWith('data-') ? node.dataset[attr[1].slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] : node.getAttribute(attr[1]);
          return attr[2] === undefined ? value != null : value === attr[2];
        }
        return node.tagName === selector;
      });
    }
    set innerHTML(markup) {
      this.replaceChildren(); const stack = [this];
      for (const match of markup.matchAll(/<(\/)?([\w-]+)([^>]*)>/g)) {
        if (match[1]) { if (stack.at(-1)?.tagName === match[2]) stack.pop(); continue; }
        const node = new Element(match[2]);
        for (const attribute of match[3].matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(attribute[1], attribute[2]);
        stack.at(-1).append(node);
        if (!match[3].endsWith('/') && !['img', 'input', 'br', 'hr'].includes(match[2])) stack.push(node);
      }
    }
  }
  doc.createElement = tag => new Element(tag);
  doc.createElementNS = (_namespace, tag) => new Element(tag);
  doc.body = new Element('body'); doc.activeElement = doc.body;
  globalThis.document = doc;
  globalThis.window = { requestAnimationFrame: callback => frames.push(callback) };
  t.after(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { Element, doc, loads, nodes: () => descendants(doc.body), flushFrames: () => { while (frames.length) frames.shift()(); } };
}

export function journalFixture(t, state = createInitialState(), callbacks = {}) {
  const dom = installJournalDOM(t), dialog = new dom.Element('dialog');
  dialog.className = 'journal-dialog'; dom.doc.body.append(dialog);
  for (const [tag, id, className] of [['header', 'journal-header', 'journal-header'], ['div', 'journal-tabs', 'journal-tabs'], ['div', 'journal-list'], ['strong', 'journal-count'], ['p', 'journal-intro'], ['p', 'journal-bottom-note']]) {
    const node = new dom.Element(tag); node.id = id; node.className = className ?? ''; dialog.append(node);
  }
  let currentState = state;
  const journal = createJournal({ dialog, getState: () => currentState, asset: file => `/assets/${file}`,
    openDialog: target => { if (!target.open) target.showModal(); }, getPhotoStatus: () => ({ total: 0, unlocked: 0 }), ...callbacks });
  return { ...dom, dialog, journal, setState: state => { currentState = state; },
    tab: name => dialog.querySelectorAll('[data-journal-filter]').find(node => node.dataset.journalFilter === name),
    control: name => dom.nodes().find(node => node.dataset.albumControl === name),
    card: id => dialog.querySelector('#journal-list').children.find(node => node.dataset.buildingId === id),
    sources: () => descendants(dialog.querySelector('#journal-list')).filter(node => node.tagName === 'img').map(image => image.src),
    photoSources: () => descendants(dialog.querySelector('.journal-photos')).filter(node => node.tagName === 'img').map(image => image.src).filter(Boolean),
  };
}
