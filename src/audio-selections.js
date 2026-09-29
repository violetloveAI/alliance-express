// User selections from the second listening round. Audio bytes remain unchanged.
const baseUrl = import.meta.env?.BASE_URL ?? '/';

export const SELECTED_SOUNDS = Object.freeze({
  'ui-confirm': Object.freeze({ url: `${baseUrl}audio/sfx/ui-confirm.flac`, volume: 0.65 }),
  'move': Object.freeze({ url: `${baseUrl}audio/sfx/move.ogg`, volume: 0.65 }),
  'discovery': Object.freeze({ url: `${baseUrl}audio/sfx/discovery.mp3`, volume: 0.205 }),
  'memory-open': Object.freeze({ url: `${baseUrl}audio/sfx/memory-open.wav`, volume: 0.65 }),
  'page-turn': Object.freeze({ url: `${baseUrl}audio/sfx/page-turn.wav`, volume: 0.65 }),
  'gift-ready': Object.freeze({ url: `${baseUrl}audio/sfx/gift-ready.mp3`, volume: 0.265, start: 0, end: 4 }),
  'gift-open': Object.freeze({ url: `${baseUrl}audio/sfx/gift-open.mp3`, volume: 0.65 }),
  'birthday': Object.freeze({ url: `${baseUrl}audio/sfx/birthday.mp3`, volume: 0.65 }),
  'world-reveal': Object.freeze({ url: `${baseUrl}audio/sfx/world-reveal.mp3`, volume: 0.65 }),
});
