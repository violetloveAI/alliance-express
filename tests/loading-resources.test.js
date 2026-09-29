import test from 'node:test';
import assert from 'node:assert/strict';

let prepareStartup;
try { ({ prepareStartup } = await import('../src/loading-resources.js')); } catch {}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('startup never reports ready before both cover decoding and app initialization finish', async () => {
  assert.equal(typeof prepareStartup, 'function');
  const cover = deferred(), app = deferred(), fonts = deferred();
  const progress = [];
  const result = prepareStartup({
    loadCover: () => cover.promise, loadApp: () => app.promise,
    loadFonts: () => fonts.promise, onProgress: value => progress.push(value),
  });
  assert.equal(progress[0], 1);
  app.resolve({ showCover() {} });
  fonts.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(progress.at(-1) < 100, 'an unfinished cover must hold the loading screen');
  cover.resolve();
  const ready = await result;
  assert.equal(typeof ready.app.showCover, 'function');
  assert.equal(progress.at(-1), 100);
  assert.ok(progress.every((value, i) => Number.isInteger(value) && value >= 1 && value <= 100 && (!i || value >= progress[i - 1])));
});

test('optional font failure uses system fonts and still makes the cover available', async () => {
  assert.equal(typeof prepareStartup, 'function');
  const progress = [];
  const result = await prepareStartup({ loadApp: async () => ({ ready: true }), loadCover: async () => {},
    loadFonts: async () => { throw new Error('font unavailable'); }, onProgress: value => progress.push(value) });
  assert.equal(result.app.ready, true);
  assert.equal(progress.at(-1), 100);
});

test('a failed critical image or application cannot claim 100 percent readiness', async () => {
  assert.equal(typeof prepareStartup, 'function');
  for (const failed of ['cover', 'app']) {
    const progress = [];
    const crash = async () => { throw new Error(`${failed} unavailable`); };
    await assert.rejects(prepareStartup({ loadApp: failed === 'app' ? crash : async () => ({}),
      loadCover: failed === 'cover' ? crash : async () => {}, loadFonts: async () => {},
      onProgress: value => progress.push(value) }), new RegExp(`${failed} unavailable`));
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(progress.every(value => value < 100));
  }
});
