// Shared artwork for the arrival popup and collected pages.
// Callers enforce visit or birthday access before creating any art.
import { createGameScenery } from './game-scenery.js';

export function createMemoryArt(tile, asset, { compact = false } = {}) {
  if (!tile.heroPortraits?.length) {
    const image = document.createElement('img');
    image.src = asset(tile.illustration ?? `illustrations/${tile.id}.webp`);
    image.alt = tile.artAlt ?? `Water Sheep 与 Violet 的${tile.title}插画`;
    if (tile.artFit === 'contain') image.className = 'memory-photo-art';
    image.decoding = 'async';
    image.width = 512; image.height = 512;
    if (compact) image.loading = 'lazy';
    return image;
  }
  const gallery = document.createElement('div');
  gallery.className = `hero-gallery hero-gallery--${tile.id}${compact ? ' hero-gallery--compact' : ''}`;
  gallery.setAttribute('role', 'group');
  gallery.setAttribute('aria-label', `${tile.title}：${tile.id === 'alliance' ? '六边格领土、秦城楼与高卢村落里的两位同盟' : '有河道、防御塔与水晶的王者峡谷里的两位队友'}`);
  gallery.append(createGameScenery(tile.id));
  tile.heroPortraits.forEach(portrait => {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    image.src = asset(portrait.file);
    image.alt = `${portrait.character}，代表 ${portrait.player}`;
    image.decoding = 'async';
    if (compact) image.loading = 'lazy';
    const caption = document.createElement('figcaption');
    const character = document.createElement('b'); character.textContent = portrait.character;
    const player = document.createElement('span'); player.textContent = portrait.player;
    caption.append(character, player); figure.append(image, caption); gallery.append(figure);
  });
  return gallery;
}
