import { MEMORY_TILES, canInspectMemory, getArrivalMemory, getVillageArrival, tileKey } from './exploration.js';
import { getUnlockedPhotos } from './photo-access.js';

// Reading and moving are separate events. Opening a gift must never add a step.
export function createDiscoveryLog() {
  let discoveries = [];
  let recorded = new Set();
  let unread = { journal: false, timeline: false };
  return {
    advance(previous, next) {
      if (next === previous || next.steps !== previous.steps + 1) return;
      const arrival = getArrivalMemory(previous, next);
      const village = getVillageArrival(previous, next);
      const newlyAvailable = MEMORY_TILES.some(tile => canInspectMemory(next, tile) && !canInspectMemory(previous, tile));
      const beforePhotos = new Set(getUnlockedPhotos(previous).map(photo => photo.id));
      const newPhotos = getUnlockedPhotos(next).some(photo => !beforePhotos.has(photo.id));
      if (newlyAvailable || newPhotos) unread.journal = true;
      if (arrival || village || next.steps === 25 || newPhotos) unread.timeline = true;
    },
    reveal(state, tile, { inJournal = false } = {}) {
      const canonical = MEMORY_TILES.find(memory => memory.id === tile?.id);
      if (!canonical || !canInspectMemory(state, canonical) || recorded.has(canonical.id)
        || state.trail.some(point => tileKey(point) === tileKey(canonical))) return false;
      recorded.add(canonical.id);
      discoveries.push({ id: `reveal:${canonical.id}`, step: state.steps, memoryId: canonical.id });
      unread.timeline = true;
      if (!inJournal) unread.journal = true;
      return true;
    },
    acknowledge(book) { if (Object.hasOwn(unread, book)) unread[book] = false; },
    getDiscoveries() { return discoveries.map(event => ({ ...event })); },
    getUnread() { return { ...unread }; },
    reset() { discoveries = []; recorded = new Set(); unread = { journal: false, timeline: false }; },
  };
}
