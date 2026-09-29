import test from 'node:test';
import assert from 'node:assert/strict';
import { JourneyAudio } from '../src/audio.js';
import { SELECTED_SOUNDS } from '../src/audio-selections.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function mediaFixture(t, play = () => Promise.resolve()) {
  const players = [];
  t.mock.method(globalThis, 'Audio', function (src) {
    const player = Object.assign(new EventTarget(), {
      src, loop: false, volume: 1, preload: 'auto', paused: true,
      currentTime: 0, playbackRate: 1, readyState: 1,
      play() { this.paused = false; this.dispatchEvent(new Event('playing')); return play(this); },
      pause() { this.paused = true; this.dispatchEvent(new Event('pause')); },
      emit(type) { this.dispatchEvent(new Event(type)); },
    });
    players.push(player);
    return player;
  });
  return players;
}
// Node has no audio device. Only the browser media boundary is replaced.
if (!globalThis.Audio) globalThis.Audio = function () {};

test('enabling starts the chosen recording as one looping player, and disabling stops it', async t => {
  const players = mediaFixture(t);
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3' });
  assert.equal(audio.enabled, false);
  assert.equal(players.length, 0);
  assert.equal(await audio.enable(), true);
  assert.equal(audio.enabled, true);
  assert.equal(players[0].src, '/music/carefree.mp3');
  assert.equal(players[0].loop, true);
  audio.disable();
  assert.equal(audio.enabled, false);
  assert.equal(players[0].paused, true);
  await audio.enable();
  assert.equal(players.length, 1, 'toggling sound must not layer duplicate music');
});

test('turning sound off while playback is pending wins over a late success', async t => {
  let finish;
  const players = mediaFixture(t, () => new Promise(resolve => { finish = resolve; }));
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3' });
  const started = audio.enable();
  audio.disable();
  assert.equal(typeof finish, 'function', 'enable must request media playback');
  finish();
  assert.equal(await started, false);
  assert.equal(audio.enabled, false);
  assert.equal(players[0].paused, true);
});

test('a rejected autoplay request leaves the game muted and allows a later retry', async t => {
  let reject = true;
  mediaFixture(t, () => reject ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve());
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3' });
  assert.equal(await audio.enable(), false);
  assert.equal(audio.enabled, false);
  reject = false;
  assert.equal(await audio.enable(), true);
  assert.equal(audio.enabled, true);
});

test('an obsolete play failure cannot mute a newer successful enable', async t => {
  let failOld, attempt = 0;
  mediaFixture(t, () => ++attempt === 1 ? new Promise((_,reject) => { failOld=reject; }) : Promise.resolve());
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3' });
  const old = audio.enable();
  audio.disable();
  assert.equal(await audio.enable(), true);
  failOld(new Error('old aborted play'));
  assert.equal(await old, false);
  assert.equal(audio.enabled, true);
});

test('departure starts music within the user gesture and later departures preserve a manual mute', async t => {
  const players = mediaFixture(t);
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3' });
  const started = audio.start();
  assert.equal(players[0]?.paused, false, 'play must be requested before awaiting departure');
  assert.equal(await started, true);
  audio.disable();
  assert.equal(await audio.start(), false);
  assert.equal(audio.enabled, false);
  assert.equal(players[0].paused, true);
});

test('backgrounding pauses music and effects while returning restores music at the same position', async t => {
  const players = mediaFixture(t);
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: selectedFixture });
  await audio.start();
  await audio.play('birthday');
  players[0].currentTime = 32;
  audio.suspend();
  assert.equal(audio.enabled, true, 'backgrounding must preserve the sound preference');
  assert.equal(players.every(player => player.paused), true);
  assert.equal(await audio.play('ui-confirm'), false, 'hidden pages must not create new effects');
  assert.equal(await audio.resume(), true);
  assert.equal(players.length, 2);
  assert.equal(players[0].paused, false);
  assert.equal(players[0].currentTime, 32);
  assert.equal(players[1].paused, true, 'old effects must not replay when returning');
  audio.disable();
});

test('returning to the page never overrides a manual mute or starts music before departure', async t => {
  const players = mediaFixture(t);
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3' });
  audio.suspend();
  assert.equal(await audio.resume(), false);
  assert.equal(players.length, 0);
  await audio.start();
  audio.disable();
  audio.suspend();
  assert.equal(await audio.resume(), false);
  assert.equal(audio.enabled, false);
  assert.equal(players[0].paused, true);
});

test('an interrupted start cannot erase playback intent when its old play request rejects', async t => {
  let failOld, attempt = 0;
  const players = mediaFixture(t, () => ++attempt === 1
    ? new Promise((_, reject) => { failOld = reject; }) : Promise.resolve());
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3' });
  const started = audio.start();
  audio.suspend();
  failOld(new Error('play interrupted by background pause'));
  assert.equal(await started, false);
  assert.equal(audio.enabled, true);
  assert.equal(await audio.resume(), true);
  assert.equal(players[0].paused, false);
  audio.disable();
});

test('muting while a resumed play is pending wins over its eventual completion', async t => {
  let finishResume, attempt = 0;
  const players = mediaFixture(t, () => ++attempt === 1 ? Promise.resolve()
    : new Promise(resolve => { finishResume = resolve; }));
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3' });
  await audio.start();
  audio.suspend();
  const resumed = audio.resume();
  audio.disable();
  finishResume();
  assert.equal(await resumed, false);
  assert.equal(audio.enabled, false);
  assert.equal(players[0].paused, true);
});


const selectedFixture = {
  'ui-confirm': { url: '/nested/audio/sfx/ui-confirm.flac', volume: 0.65 },
  birthday: { url: '/nested/audio/sfx/birthday.mp3', volume: 0.65 },
  'gift-ready': { url: '/nested/audio/sfx/gift-ready.mp3', volume: 0.265, start: 0, end: 4 },
};

test('selected effects use the configured original file and remain silent until enabled', async t => {
  const players = mediaFixture(t);
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: selectedFixture });
  assert.equal(typeof audio.play, 'function', 'the engine must expose selected event playback');
  assert.equal(await audio.play('ui-confirm'), false);
  assert.equal(players.length, 0);
  await audio.enable();
  assert.equal(await audio.play('ui-confirm'), true);
  assert.equal(players[1].src, '/nested/audio/sfx/ui-confirm.flac');
  assert.equal(players[1].volume, 0.65);
  assert.equal(players[1].loop, false);
  assert.equal(await audio.play('restart'), false, 'cancelled event 10 has no audio');
  assert.equal(players.length, 2);
  audio.disable();
});

test('a newer effect replaces pending playback and stale failures cannot stop it', async t => {
  let failOld;
  const players = mediaFixture(t, player => player.src.endsWith('.flac')
    ? new Promise((_, reject) => { failOld = reject; }) : Promise.resolve());
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: selectedFixture });
  await audio.enable();
  const old = audio.play('ui-confirm');
  assert.equal(await audio.play('birthday'), true);
  assert.equal(players[1].paused, true);
  failOld(new Error('old playback aborted'));
  assert.equal(await old, false);
  players[1].emit('ended');
  assert.equal(players[2].paused, false);
  assert.equal(players[0].volume, 0.096, 'obsolete finish must not restore music over a new effect');
  audio.disable();
});

test('natural completion restores the music baseline and preserves long celebration tails', async t => {
  const players = mediaFixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: selectedFixture });
  await audio.enable();
  await audio.play('birthday');
  assert.equal(players[0].volume, 0.096);
  t.mock.timers.tick(12000);
  assert.equal(players[1].paused, false, 'full original must end via media ended, not a guessed timer');
  players[1].emit('ended');
  assert.equal(players[0].volume, 0.24);
  assert.equal(players[0].paused, false);
  audio.disable();
});

test('gift preview uses media time and stops at four seconds without cutting stalled playback', async t => {
  const players = mediaFixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: selectedFixture });
  await audio.enable();
  await audio.play('gift-ready');
  const gift = players[1];
  gift.currentTime = 1;
  t.mock.timers.tick(4000);
  assert.equal(gift.paused, false, 'wall time does not imply four seconds of audible playback');
  gift.currentTime = 4;
  gift.emit('timeupdate');
  assert.equal(gift.paused, true);
  assert.equal(players[0].volume, 0.24);
  audio.disable();
});

test('stopEffects cancels the previous range timer while keeping looping music enabled', async t => {
  const players = mediaFixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: selectedFixture });
  await audio.enable();
  await audio.play('gift-ready');
  audio.stopEffects();
  assert.equal(audio.enabled, true);
  assert.equal(players[1].paused, true);
  assert.equal(players[0].volume, 0.24);
  await audio.play('birthday');
  players[1].currentTime = 4;
  t.mock.timers.tick(20000);
  assert.equal(players[2].paused, false);
  assert.equal(players[0].volume, 0.096);
  audio.disable();
});

test('disable cancels pending effects and cannot be undone by late playback completion', async t => {
  let finishEffect;
  const players = mediaFixture(t, player => player.src.includes('gift-ready')
    ? new Promise(resolve => { finishEffect = resolve; }) : Promise.resolve());
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: selectedFixture });
  await audio.enable();
  const pending = audio.play('gift-ready');
  audio.disable();
  finishEffect();
  assert.equal(await pending, false);
  t.mock.timers.tick(20000);
  assert.equal(audio.enabled, false);
  assert.equal(players.every(player => player.paused), true);
  assert.equal(await audio.play('birthday'), false);
});

test('nonzero excerpts seek after metadata and obey their own ending time', async t => {
  const players = mediaFixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: { excerpt: { url: '/range.wav', start: 2, end: 3, volume: 0.5 } } });
  await audio.enable();
  await audio.play('excerpt');
  players[1].emit('loadedmetadata');
  assert.equal(players[1].currentTime, 2);
  players[1].currentTime = 3;
  players[1].emit('timeupdate');
  assert.equal(players[1].paused, true);
  audio.disable();
});


test('all nine approved choices play their unchanged published files; event ten stays absent', async t => {
  const approved = {
    'ui-confirm': 'b44c05bdb39bb06ff9beefb56888a76e34aa195afbbc28df5afad89f7f46f6eb',
    move: '34e6057ec1581b5cb8802e4942952b00b1dac235bfcb0ed8cff0ceb15a3ebbbf',
    discovery: 'f54fa30d327e76974df1271867fcf4efb7185d2f893bcb8ff3da561ab82607b4',
    'memory-open': '3ee7769b3c69b36eb7ab6ea4cc749ac50c26218fefddddaaae8786cf974c34eb',
    'page-turn': '16e2bcf51fde1fc1ee495830c67ea30639ce31b6fe1fb39e5d76c50a55bad73c',
    'gift-ready': 'd0ed796588bb3715293e34ffbe06f6b9c91655b432dd5cc243d681eaeffc9e28',
    'gift-open': 'f7ee56b36e21a80a3420db8c11330b86c0cf0b350d5f94ec0e1e85d15920b201',
    birthday: 'b38674303fb5c6ec0d714b02b95b3a1a227ef886822636cc38cc5099eae14aa2',
    'world-reveal': '3eb1692c45d9f51d776c928f53be44c2098c10ab768d085e843c3559792f83ec',
  };
  const players = mediaFixture(t);
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: SELECTED_SOUNDS });
  await audio.enable();
  assert.deepEqual(Object.keys(SELECTED_SOUNDS), Object.keys(approved));
  for (const [event, hash] of Object.entries(approved)) {
    assert.equal(await audio.play(event), true);
    const file = new URL(`../public${players.at(-1).src}`, import.meta.url);
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), hash, event);
  }
  assert.equal(await audio.play('restart'), false);
  audio.disable();
});

test('an active load error restores music and leaves the next effect usable', async t => {
  const players = mediaFixture(t);
  const audio = new JourneyAudio({ musicUrl: '/music/carefree.mp3', sounds: selectedFixture });
  await audio.enable();
  await audio.play('ui-confirm');
  players[1].emit('error');
  assert.equal(players[0].volume, 0.24);
  assert.equal(await audio.play('birthday'), true);
  assert.equal(players[0].volume, 0.096);
  audio.disable();
});
