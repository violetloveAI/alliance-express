import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as exploration from '../src/exploration.js';
import { createDiscoveryLog } from '../src/discovery-log.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
// Exercise the production handlers while holding travel at its async boundary.
// The map, audio and DOM surfaces are stubs; movement rules remain real.
const renderSource = main.slice(main.indexOf('function render(){'), main.indexOf('function toast('));
const goSource = main.slice(main.indexOf('async function go('), main.indexOf('const openers='));

function journey() {
  const nodes = new Map();
  const timers = [];
  let arrive;
  const $ = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent: '', dataset: {}, style: {}, disabled: false,
      querySelector: () => ({ hidden: true }), setAttribute() {},
      classList: { remove() {}, toggle() {} },
    });
    return nodes.get(selector);
  };
  const api = runInNewContext(`
    let state=createInitialState(),busy=false,gameStarted=true;
    let pendingBirthdayMemory=null,pendingBirthdayVillage=null,birthdayRevealPending=false,celebrationTimer;
    ${renderSource}
    ${goSource}
    render();
    ({go,getState:()=>state});
  `, {
    ...exploration, $, document: { querySelector: () => null },
    scene: { travel: () => new Promise(resolve => { arrive = resolve; }) },
    audio: { play() {} }, journal: { close() {} }, discoveryLog: createDiscoveryLog(),
    toast() {}, showMemory() {}, openDialog() {},
    setTimeout: callback => timers.push(callback),
  });
  return {
    ...api,
    land: () => arrive(),
    finishCelebration: () => { while (timers.length) timers.shift()(); },
    count: () => $('#step-count').textContent,
    glowing: () => $('.step-counter').dataset.milestone === 'true',
  };
}

test('only completed step 24 and step 25 glow; the next departure restores ordinary numbers', async () => {
  const game = journey();
  assert.equal(game.count(), '0');
  assert.equal(game.glowing(), false);
  for (let step = 1; step <= 26; step++) {
    const pending = game.go({ q: step % 2 ? -1 : 0, r: 0 });
    assert.equal(game.count(), String(step));
    assert.equal(game.glowing(), step === 25, `in transit to ${step}`);
    game.land();
    await pending;
    assert.equal(game.glowing(), step === 24 || step === 25, `arrived at ${step}`);
    if (step === 25) {
      game.finishCelebration();
      assert.equal(game.glowing(), true, 'birthday dialog keeps the glow');
    }
  }
});
