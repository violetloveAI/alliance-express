import assignments from './photo-assignments.json' with { type: 'json' };
import { PHOTOS } from './photos.js';
import { MEMORY_TILES, canInspectMemory, getVillageVisits, tileKey } from './exploration.js';

const photosById = new Map(PHOTOS.map(photo => [photo.id, photo]));
const buildingsById = new Map(MEMORY_TILES.map(building => [building.id, building]));
const school = buildingsById.get('school');

export function getBuildingPhotoIds(buildingId) {
  const ids = buildingId === 'birthday' ? assignments.birthday
    : buildingsById.has(buildingId) ? assignments.buildings[buildingId] : [];
  return [...new Set(Array.isArray(ids) ? ids : [])].filter(id => photosById.has(id));
}

function accessContext(state) {
  // Reuse the trail validator. A forged visited array or birthdayAt flag must not
  // turn a merely visible building into a source of unlocked photos.
  if (!canInspectMemory(state, school)) return null;
  const activeIds = new Set([
    ...MEMORY_TILES.flatMap(building => getBuildingPhotoIds(building.id)),
    ...getBuildingPhotoIds('birthday'),
  ]);
  return {
    all: state.steps >= 25, visited: new Set(state.trail.map(tileKey)), activeIds,
    gifted: new Set(state.steps >= 25 ? [] : getVillageVisits(state).flatMap(reward => reward.unlockedIds)),
  };
}

function allowed(context, photo) {
  if (!context || !photo || !context.activeIds.has(photo.id)) return false;
  if (context.all) return true;
  return MEMORY_TILES.some(building => (context.visited.has(tileKey(building)) || context.gifted.has(building.id))
    && getBuildingPhotoIds(building.id).includes(photo.id));
}

export function isPhotoUnlocked(state, photoOrId) {
  const id = typeof photoOrId === 'string' ? photoOrId : photoOrId?.id;
  return allowed(accessContext(state), photosById.get(id));
}

export function getUnlockedPhotos(state) {
  const context = accessContext(state);
  return PHOTOS.filter(photo => allowed(context, photo));
}

export function getBuildingPhotoStatus(state, buildingId) {
  const ids = getBuildingPhotoIds(buildingId);
  const context = accessContext(state);
  return { total: ids.length, unlocked: ids.filter(id => allowed(context, photosById.get(id))).length };
}
