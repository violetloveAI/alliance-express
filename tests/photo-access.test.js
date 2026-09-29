import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerHooks } from 'node:module';
import { PHOTOS } from '../src/photos.js';
import assignments from '../src/photo-assignments.json' with { type: 'json' };
import { createInitialState, move, MEMORY_TILES } from '../src/exploration.js';
import { getBuildingPhotoIds, getUnlockedPhotos, getBuildingPhotoStatus, isPhotoUnlocked } from '../src/photo-access.js';
import { collectAssignments, syncPhotos } from '../scripts/sync-photos.mjs';

// Photo assignments are user-editable. At the initial school, only files
// explicitly assigned to school may be requested by any album entry point.
const schoolIds = [...assignments.buildings.school];
const photoById = id => PHOTOS.find(photo => photo.id === id);
const schoolSources = new Set(PHOTOS.filter(photo => schoolIds.includes(photo.id)).map(photo => `/assets/${photo.src}`));

function afterSteps(steps) {
  let state = createInitialState();
  for (let step = 1; step <= steps; step++) state = move(state, { q: step % 2 ? -1 : 0, r: 0 });
  return state;
}

test('the school begins with no photos after the user moves later photos to their own memories', () => {
  assert.deepEqual(schoolIds, []);
  assert.deepEqual(getUnlockedPhotos(createInitialState()), []);
  assert.deepEqual(getUnlockedPhotos(createInitialState()).map(photo => photo.id).sort(), [...schoolIds].sort());
  assert.deepEqual(getBuildingPhotoStatus(createInitialState(), 'school'), { total: schoolIds.length, unlocked: schoolIds.length });
});

test('a first building visit unlocks its photos while merely seen buildings stay locked', () => {
  const before = createInitialState(), after = move(before, { q: 1, r: 0 });
  const ids = getBuildingPhotoIds('canteen');
  assert.ok(ids.length > 0);
  assert.ok(ids.every(id => !isPhotoUnlocked(before, id)));
  assert.ok(ids.every(id => isPhotoUnlocked(after, id)));
  assert.deepEqual(getBuildingPhotoStatus(after, 'canteen'), { total: ids.length, unlocked: ids.length });
  assert.equal(isPhotoUnlocked(after, 'photo-01'), false);
});

test('the twenty-fifth step opens all photos including birthday without visiting every building', () => {
  const before = afterSteps(24), after = afterSteps(25);
  assert.equal(isPhotoUnlocked(before, 'photo-19'), false);
  assert.equal(getUnlockedPhotos(after).length, PHOTOS.length);
  assert.equal(isPhotoUnlocked(after, 'photo-19'), true);
  assert.equal(getUnlockedPhotos(afterSteps(26)).length, PHOTOS.length);
  assert.deepEqual(getBuildingPhotoStatus(after, 'birthday'), { total: 1, unlocked: 1 });
});

test('invalid states and forged photo objects cannot bypass the access gate', () => {
  for (const state of [null, {}, { steps: 25 }, { ...createInitialState(), steps: 25 }]) {
    assert.deepEqual(getUnlockedPhotos(state), []);
    assert.equal(isPhotoUnlocked(state, 'photo-19'), false);
  }
  const forged = { ...createInitialState(), visited: ['0,0', '1,0'], birthdayAt: { q: 0, r: 0 } };
  assert.equal(isPhotoUnlocked(forged, getBuildingPhotoIds('canteen')[0]), false);
  assert.equal(isPhotoUnlocked(createInitialState(), { id: 'photo-19', spoiler: false }), false);
  assert.equal(isPhotoUnlocked(afterSteps(25), 'unknown'), false);
});

test('building lookups are defensive and empty hobby groups are allowed', () => {
  const ids = getBuildingPhotoIds('school');
  ids.push('photo-19');
  assert.deepEqual(getBuildingPhotoIds('school'), schoolIds);
  assert.deepEqual(getBuildingPhotoIds('unknown'), []);
  assert.deepEqual(getBuildingPhotoStatus(createInitialState(), 'badminton'), { total: 0, unlocked: 0 });
});

test('moving the default birthday photo to a building makes its visit the access rule', () => {
  const original = assignments.buildings.canteen;
  const birthday = assignments.birthday;
  try {
    assignments.buildings.canteen = [...original, 'photo-19'];
    assignments.birthday = [];
    assert.equal(isPhotoUnlocked(createInitialState(), 'photo-19'), false);
    assert.equal(isPhotoUnlocked(move(createInitialState(), { q: 1, r: 0 }), 'photo-19'), true);
    assert.deepEqual(getBuildingPhotoIds('birthday'), []);
  } finally {
    assignments.buildings.canteen = original;
    assignments.birthday = birthday;
  }
});


function withUnassignedPhoto(id, check) {
  const previous = { buildings: { ...assignments.buildings }, birthday: assignments.birthday };
  try {
    for (const [buildingId, ids] of Object.entries(assignments.buildings)) {
      assignments.buildings[buildingId] = ids.filter(photoId => photoId !== id);
    }
    assignments.birthday = assignments.birthday.filter(photoId => photoId !== id);
    return check();
  } finally {
    Object.assign(assignments.buildings, previous.buildings);
    assignments.birthday = previous.birthday;
  }
}

test('removing a photo from every building hides it even after 25 steps without deleting its registry entry', () => {
  const state = afterSteps(25);
  assert.equal(isPhotoUnlocked(state, 'photo-01'), true);
  withUnassignedPhoto('photo-01', () => {
    assert.ok(photoById('photo-01'), 'the retained source catalogue is not an access grant');
    assert.equal(isPhotoUnlocked(state, 'photo-01'), false);
    assert.ok(getUnlockedPhotos(state).every(photo => photo.id !== 'photo-01'));
    assert.equal(getUnlockedPhotos(state).length, PHOTOS.length - 1);
  });
  assert.equal(isPhotoUnlocked(state, 'photo-01'), true);
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'water-sheep-photo-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'photos');
  await mkdir(directory);
  async function folder(name, buildingId, files = []) {
    const path = join(directory, name);
    await mkdir(path);
    await writeFile(join(path, '.building.json'), JSON.stringify({ buildingId }));
    for (const filename of files) await writeFile(join(path, filename), `original:${filename}`);
    return path;
  }
  return { root, directory, folder };
}

test('sync accepts empty buildings and cross-folder reuse, preserving originals', async t => {
  const f = await fixture(t);
  const original = photoById('photo-06').original;
  const source = await f.folder('01 学校', 'school', [original]);
  await f.folder('02 吃饭', 'canteen', [original]);
  await f.folder('15 羽毛球', 'badminton');
  const outputPath = join(f.root, 'assignments.json');
  const result = await syncPhotos({ directory: f.directory, outputPath });
  assert.deepEqual(result.assignments.buildings.school, ['photo-06']);
  assert.deepEqual(result.assignments.buildings.canteen, ['photo-06']);
  assert.deepEqual(result.assignments.buildings.badminton, []);
  assert.equal(Object.keys(result.assignments.buildings).length, MEMORY_TILES.length);
  assert.match(result.warnings.join('\n'), /跨目录/);
  assert.equal(await readFile(join(source, original), 'utf8'), `original:${original}`);
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), result.assignments);
});

test('sync identifies unknown files and leaves the previous output untouched', async t => {
  const f = await fixture(t);
  await f.folder('01 学校', 'school', ['陌生照片.jpg']);
  const outputPath = join(f.root, 'assignments.json');
  await writeFile(outputPath, 'previous assignments');
  await assert.rejects(syncPhotos({ directory: f.directory, outputPath }), /未知照片.*陌生照片/);
  assert.equal(await readFile(outputPath, 'utf8'), 'previous assignments');
});

test('sync rejects duplicate building IDs and missing metadata with explicit errors', async t => {
  const f = await fixture(t);
  await f.folder('01 学校', 'school');
  await f.folder('02 重复学校', 'school');
  await assert.rejects(collectAssignments(f.directory), /重复建筑 ID.*school/);
  await rm(join(f.directory, '02 重复学校'), { recursive: true });
  await mkdir(join(f.directory, '没有标记的目录'));
  await assert.rejects(collectAssignments(f.directory), /缺少.*\.building\.json/);
});

test('sync reports same-building duplicates but permits moving the birthday photo to a building', async t => {
  const f = await fixture(t);
  const folder = await f.folder('01 学校', 'school', [photoById('photo-06').original]);
  await mkdir(join(folder, '副本'));
  await writeFile(join(folder, '副本', photoById('photo-06').original), 'duplicate');
  await assert.rejects(collectAssignments(f.directory), /同一建筑.*重复照片/);
  await rm(join(folder, '副本'), { recursive: true });
  await writeFile(join(folder, photoById('photo-19').original), 'spoiler');
  const result = await collectAssignments(f.directory);
  assert.deepEqual(result.assignments.buildings.school, ['photo-06', 'photo-19']);
  assert.deepEqual(result.assignments.birthday, []);
});

test('sync accepts birthday originals and reports unassigned photos without deleting anything', async t => {
  const f = await fixture(t);
  await f.folder('22 生日星光', 'birthday', [photoById('photo-19').original]);
  const result = await collectAssignments(f.directory);
  assert.deepEqual(result.assignments.birthday, ['photo-19']);
  assert.match(result.warnings.join('\n'), new RegExp(`未分配照片 ${PHOTOS.length - 1} 张`));
});

const stylesheetHook = registerHooks({ load(url, context, nextLoad) {
  return url.endsWith('/photo-album.css') ? { format: 'module', source: '', shortCircuit: true } : nextLoad(url, context);
} });
const { createPhotoAlbum } = await import('../src/photo-album.js');
stylesheetHook.deregister();

function albumDOM(t) {
  const originals = new Map(['document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const doc = {}, frames = [], loads = [];
  const all = root => [root, ...root.children.flatMap(all)];
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = new Map(); this.listeners = new Map(); this.open = false; this.disabled = false; this.hidden = false; this.textContent = ''; }
    get isConnected() { return this === doc.body || Boolean(this.parent?.isConnected); }
    set src(value) { this.setAttribute('src', value); loads.push(value); }
    get src() { return this.getAttribute('src'); }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    replaceChildren(...nodes) { for (const node of this.children) node.parent = null; this.children = []; this.append(...nodes); }
    setAttribute(key, value) { this.attrs.set(key, String(value)); }
    getAttribute(key) { return this.attrs.get(key) ?? null; }
    removeAttribute(key) { this.attrs.delete(key); }
    contains(node) { return all(this).includes(node); }
    querySelectorAll(selector) { return all(this).slice(1).filter(node => selector === '[data-album-control]' ? node.dataset.albumControl : selector === '[aria-pressed="true"]' ? node.getAttribute('aria-pressed') === 'true' : selector === '[aria-current="true"]' && node.getAttribute('aria-current') === 'true'); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    addEventListener(type, callback) { const list = this.listeners.get(type) ?? []; list.push(callback); this.listeners.set(type, list); }
    emit(type) { for (const callback of this.listeners.get(type) ?? []) callback({ target: this, stopPropagation() {} }); }
    click() { if (!this.disabled) this.emit('click'); }
    focus() { doc.activeElement = this; }
    scrollIntoView() {}
    showModal() { this.open = true; }
    close() { if (this.open) { this.open = false; this.emit('close'); } }
  }
  doc.createElement = tag => new Element(tag); doc.body = new Element('body'); doc.activeElement = doc.body;
  globalThis.document = doc; globalThis.window = { requestAnimationFrame: callback => frames.push(callback) };
  t.after(() => { for (const [key, value] of originals) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } });
  return { loads, nodes: () => all(doc.body), button: id => all(doc.body).find(node => node.dataset.albumControl === id), text: () => all(doc.body).map(node => node.textContent).join(' ') };
}

test('every album entry path filters locked photos before assigning any image src', t => {
  const dom = albumDOM(t), state = createInitialState();
  const album = createPhotoAlbum({ getState: () => state });
  for (const options of [{}, { category: 'journeys' }, { buildingId: 'zhangzhou' }, { ids: PHOTOS.map(photo => photo.id) }, { buildingId: 'birthday', ids: ['photo-19'] }]) {
    album.open(options);
    dom.button('next').click(); dom.button('previous').click();
    if (!dom.button('show-all').hidden) dom.button('show-all').click();
    album.close();
  }
  assert.equal(dom.loads.length, 0, 'the empty initial album must never request any photo URL');
});

test('building and explicit IDs intersect instead of broadening a building album', t => {
  const dom = albumDOM(t), state = move(createInitialState(), { q: 1, r: 0 });
  const album = createPhotoAlbum({ getState: () => state });
  album.open({ buildingId: 'canteen', ids: ['photo-06'] });
  assert.equal(dom.loads.length, 0);
  dom.button('show-all').click();
  const allowed = new Set(getUnlockedPhotos(state).flatMap(photo => [
    `/assets/${photo.src}`, `/assets/memories/thumbs/${photo.id}.webp`,
  ]));
  assert.ok(dom.loads.length > 0);
  assert.ok(dom.loads.every(src => allowed.has(src)));
});

test('birthday opens all photos and resetting closes and clears all image sources', t => {
  const dom = albumDOM(t); let state = afterSteps(25);
  const album = createPhotoAlbum({ getState: () => state });
  album.open();
  assert.ok(dom.loads.includes('/assets/memories/thumbs/photo-19.webp'));
  assert.equal(dom.loads.includes('/assets/memories/19.jpg'), false, 'listing birthday photos only requests their thumbnails');
  dom.button('thumb-photo-19').click();
  assert.ok(dom.loads.includes('/assets/memories/19.jpg'), 'selecting an unlocked birthday photo requests its original');
  album.close();
  assert.ok(dom.nodes().filter(node => node.tagName === 'IMG').every(node => !node.src));
  dom.loads.length = 0; state = createInitialState(); album.open();
  assert.ok(dom.loads.every(src => schoolSources.has(src)));
});

test('a changed state is rechecked even when next has no remaining permitted photo', t => {
  const dom = albumDOM(t); let state = afterSteps(25);
  const album = createPhotoAlbum({ getState: () => state });
  album.open();
  for (let index = 0; index < 5; index++) dom.button('next').click();
  assert.ok(dom.nodes().some(node => node.dataset.albumControl === 'thumb-photo-19'));
  state = createInitialState(); dom.loads.length = 0;
  dom.button('next').click();
  assert.equal(dom.nodes().some(node => node.dataset.albumControl === 'thumb-photo-19'), false);
  assert.ok(dom.nodes().filter(node => node.tagName === 'IMG').every(node => !node.src || schoolSources.has(node.src)));
  assert.ok(dom.text().includes(`${schoolIds.length} 张照片`));
  assert.ok(dom.loads.every(src => schoolSources.has(src)));
});

test('a failed state provider shows an empty album without fetching any image', t => {
  const dom = albumDOM(t);
  createPhotoAlbum({ getState: () => { throw Error('unavailable'); } }).open();
  assert.equal(dom.loads.length, 0);
});

test('album opening notifies once per closed-to-open transition without a photo-change notification', t => {
  const dom = albumDOM(t), calls = [];
  const album = createPhotoAlbum({
    getState: () => afterSteps(25),
    onOpen: () => { assert.equal(dom.nodes().find(node => node.tagName === 'DIALOG').open, true); calls.push('open'); },
    onPhotoChange: () => calls.push('photo'),
  });
  assert.deepEqual(calls, []);
  album.open();
  album.open({ category: 'campus' });
  assert.deepEqual(calls, ['open']);
  album.close();
  album.open();
  assert.deepEqual(calls, ['open', 'open']);
});

test('album navigation notifies only for a different visible photo while open', t => {
  const dom = albumDOM(t), calls = [];
  const album = createPhotoAlbum({ getState: () => afterSteps(25), onPhotoChange: () => calls.push('photo') });
  album.open({ ids: ['photo-01', 'photo-02', 'photo-03'] });
  dom.button('previous').emit('click');
  dom.button('thumb-photo-01').click();
  assert.equal(calls.length, 0);
  dom.button('next').click();
  dom.button('previous').click();
  dom.button('thumb-photo-03').click();
  assert.equal(calls.length, 3);
  dom.button('next').emit('click');
  dom.button('thumb-photo-03').click();
  assert.equal(calls.length, 3);
  const detachedThumbnail = dom.button('thumb-photo-02');
  album.close();
  detachedThumbnail.click();
  assert.equal(calls.length, 3);
});

test('album category changes notify only when the photo changes and repeated filters keep the photo', t => {
  const dom = albumDOM(t), calls = [];
  const album = createPhotoAlbum({ getState: () => afterSteps(25), onPhotoChange: () => calls.push('photo') });
  album.open();
  dom.button('filter-journeys').click(); // The first photo already belongs to this category.
  assert.equal(calls.length, 0);
  dom.button('thumb-photo-03').click();
  dom.button('filter-journeys').click();
  assert.equal(dom.button('thumb-photo-03').getAttribute('aria-current'), 'true');
  assert.equal(calls.length, 1);
  dom.button('filter-campus').click();
  dom.button('filter-all').click();
  assert.equal(calls.length, 3);
});

test('showing all collected photos notifies only when it displays a different photo', t => {
  const dom = albumDOM(t), calls = [];
  const album = createPhotoAlbum({ getState: () => afterSteps(25), onPhotoChange: () => calls.push('photo') });
  album.open({ ids: ['photo-01', 'photo-02'] });
  dom.button('show-all').click();
  assert.equal(calls.length, 0);
  album.open({ ids: ['photo-02', 'photo-03'] });
  dom.button('show-all').click();
  assert.equal(calls.length, 1);
  album.close();
  dom.button('show-all').click();
  assert.equal(calls.length, 1);
});

test('the revised catalogue keeps old IDs stable and labels later photos using the user dates', () => {
  assert.equal(PHOTOS.length, 25);
  assert.equal(new Set(PHOTOS.map(photo => photo.id)).size, PHOTOS.length);
  assert.equal(photoById('photo-07'), undefined);
  assert.equal(photoById('photo-13'), undefined);
  assert.equal(photoById('photo-06').original, 'IMG_7164.HEIC');
  assert.equal(photoById('photo-06').dateLabel, '2023年12月');
  assert.equal(photoById('photo-05').dateLabel, '2024年5月');
  assert.equal(photoById('photo-11').dateLabel, '2024年8月');
  for (const id of ['photo-22', 'photo-23']) assert.equal(photoById(id).dateLabel, '高中阶段');
  assert.equal(photoById('photo-24').dateLabel, '2017年11月');
  assert.equal(photoById('photo-25').dateLabel, '2024年8月');
});

test('explicit photo IDs and show-all cannot reload an unassigned photo after the birthday', t => {
  const dom = albumDOM(t);
  withUnassignedPhoto('photo-01', () => {
    const album = createPhotoAlbum({ getState: () => afterSteps(25) });
    album.open({ ids: ['photo-01'] });
    assert.equal(dom.loads.length, 0);
    dom.button('show-all').click();
    assert.ok(dom.loads.length > 0);
    assert.ok(dom.loads.every(src => !src.endsWith('/01.jpg')));
    assert.equal(dom.nodes().some(node => node.dataset.albumControl === 'thumb-photo-01'), false);
    album.close();
  });
});
