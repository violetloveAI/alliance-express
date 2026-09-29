import { MAP_LAYOUT } from './map-layout.js';

export const GRID_RADIUS = 5;
export const TILE_SIZE = 150;
export const STORAGE_KEY = 'water-sheep-explore:v2';

// Bound saved trail size and replay work. At 10000 steps the existing save is
// preserved, but further moves are rejected; birthday celebrations do not stop play.
export const MAX_STEPS = 10000;

const DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

// These are memory markers on a fictional miniature map, not the real cities'
// geography or reconstructions of specific buildings. There is no chronological
// route or collection order. Assets are local filenames.
export const MEMORY_TILES = Object.freeze([
  {
    id: 'school', title: '深圳实验学校', dateLabel: '高中阶段',
    description: '从深圳实验学校开始，我们当了两年半的舍友。后来再想起那段时间，最先冒出来的居然不是大事，而是又到了饭点。',
    asset: 'school.webp', photoCategory: 'campus', unlockText: '共同起点，已经在地图上。',
  },
  {
    id: 'canteen', title: '先去食堂', dateLabel: '高中阶段',
    description: '高中吃过多少顿饭，早就数不清了。只记得一下课，就赶着去食堂；抢到热饭，再坐下来一起吃。两个人的日常，有时候就是这么简单。',
    asset: 'reunion-table.png', photoCategory: 'dining', unlockText: '发现食堂回忆：热饭 × 2。',
  },
  {
    id: 'dorm', title: '宿舍烧烤与游戏', dateLabel: '高中阶段',
    description: '高中几乎每天都一起打游戏，还有宿舍里的烧烤。具体哪一局输赢早忘了，总之队伍里有个熟悉的名字，这一把就有人陪。',
    asset: null, photoCategory: 'campus', unlockText: '发现宿舍回忆：老队友，就位。',
  },
  {
    id: 'metro', title: '龙华方向', dateLabel: '高中阶段',
    description: '一到周五，放学后一起坐地铁往龙华回家。班里住同一个方向的人不多，正好，我们有一路可以一起走。',
    asset: 'metro-station.png', photoCategory: 'campus', unlockText: '发现回家路线：龙华方向。',
  },
  {
    id: 'walk', title: '吃完饭，再走走', dateLabel: '高中阶段',
    description: '饭吃完了，也不急着散。慢慢走一段，有一句没一句地聊。没有任务，不用赶路，这一格就留给饭后散步。',
    asset: null, photoCategory: 'portraits', unlockText: '发现散步回忆：慢慢走。',
  },
  {
    id: 'shenzhen', title: '一起去看电影', dateLabel: '高中阶段',
    description: '高中一起出游、看电影的日子，也留在这一格。电影结束了，和你一起出门的回忆还在。',
    asset: 'cinema-landmark-v7.webp', illustration: 'illustrations/cinema-v7.webp', photoCategory: 'dining', unlockText: '电影开场，老队友的座位留好了。',
  },
  {
    id: 'hainan', title: '那通很长的语音', dateLabel: '2020年',
    description: '上大学以后，Violet 遇到困难时，会找 Water Sheep 语音聊很久。这一格想记住的，是你愿意听，也愿意认真帮我想办法。隔着海南和广东，那些长长的通话，也是一种陪伴。',
    asset: 'long-call-landmark-v5.webp', illustration: 'illustrations/long-call-v5.webp', photoCategory: null, unlockText: '发现一通很长、很安心的语音。',
  },
  {
    id: 'guangdong', title: '广东的这一边',
    description: 'Water Sheep 在海南，Violet 留在广东。那段时间没能见上面，但共同攒下的日子没有消失。等再见时，还是熟悉的老队友。',
    asset: null, photoCategory: null, unlockText: '发现广东这一页。',
  },
  {
    id: 'foshan', title: '旅行相册 · 佛山', dateLabel: '2024年6月',
    description: '一起去过的佛山，也收在地图里。翻翻照片，再想起那一次同行。',
    asset: null, photoCategory: 'journeys', unlockText: '翻到旅行相册：佛山。',
  },
  {
    id: 'fuzhou', title: '旅行相册 · 福州', dateLabel: '2024年11月',
    description: 'Water Sheep 读研的城市是福州，这里也有我们一起旅行的回忆。照片慢慢翻，想起一起去过的地方。',
    asset: null, photoCategory: 'journeys', unlockText: '翻到旅行相册：福州。',
  },
  {
    id: 'zhangzhou', title: '旅行相册 · 漳州', dateLabel: '2025年5月',
    description: '地图上还有漳州。风景可以慢慢看，合照也可以多留几张；以后翻到这一页，还能想起同行的人。',
    asset: null, photoCategory: 'journeys', unlockText: '翻到旅行相册：漳州。',
  },
  {
    id: 'reunion', title: '叙旧 · 2024年5月', dateLabel: '2024年5月',
    description: '2024年5月，叙旧时间。',
    asset: 'reunion-table.png', photoCategory: 'portraits', unlockText: '发现重逢回忆：又坐到一桌。',
  },
  {
    id: 'alliance', title: '文明 6 · 秦与高卢', kind: 'easter-egg', dateLabel: '2022年',
    description: 'Violet 的秦始皇，Water Sheep 的高卢。一个忙着铺开帝国，一个带着安比奥里克斯开拓新城。好多句「再来一回合」，就这样变成了我们一起度过的晚上。这次同盟不用续签，老队友一直有位置。',
    heroPortraits: [
      { character: '秦始皇', player: 'Violet', file: 'game-portraits/civ-qin-cozy-v6.webp' },
      { character: '安比奥里克斯', player: 'Water Sheep', file: 'game-portraits/civ-ambiorix-cozy-v6.webp' },
    ],
    asset: null, photoCategory: null, unlockText: '发现同盟旗帜：两位队友，都在。',
  },
  {
    id: 'honor', title: '王者荣耀 · 老队友上线', kind: 'easter-egg', dateLabel: '高中阶段',
    description: 'Violet 的貂蝉，Water Sheep 的程咬金。高中那会儿，我们几乎天天一起打游戏。后来已经很久不玩了，但那个熟悉的队友名字，和一起开下一局的日子，还留在这里。',
    heroPortraits: [
      { character: '貂蝉', player: 'Violet', file: 'game-portraits/honor-diaochan-cozy-v6.webp' },
      { character: '程咬金', player: 'Water Sheep', file: 'game-portraits/honor-chengyaojin-cozy-v6.webp' },
    ],
    asset: null, photoCategory: null, unlockText: '老队友上线：貂蝉与程咬金。',
  },
  {
    id: 'supply', title: '战地 1 · 补给站', kind: 'easter-egg',
    description: '给喜欢《战地风云1》的 Water Sheep 留了一座小小补给站。列车、双翼机和旧式营帐都在；今天最重要的补给，是下一顿饭和一路陪伴。',
    asset: null, photoCategory: null, unlockText: '发现沙盘补给站：补给就位。',
  },
  {
    id: 'badminton', title: '羽毛球小场地', kind: 'easter-egg', dateLabel: '高中阶段',
    description: '这一格留给 Water Sheep 喜欢的羽毛球。游戏之外，也记得活动活动。愿新的一岁，好球多一点，开心也多一点。',
    asset: null, photoCategory: null, unlockText: '发现羽毛球角落：喜欢的运动，也有位置。',
  },
  {
    id: 'battlefield2042', title: '2042 · 机器狗值班', kind: 'easter-egg',
    description: '前方发现近未来补给站。机器狗负责巡逻，Water Sheep 负责检查零食库存。给《战地风云2042》留的小彩蛋：这一局天气再变，也有人和你一起出发。',
    asset: null, photoCategory: null,
  },
  {
    id: 'dontstarve', title: '饥荒 · 天黑前生火', kind: 'easter-egg',
    description: '天快黑了，先添一把柴。浆果在烤，篝火还亮着，今晚不用饿肚子。给喜欢《饥荒》的你留一处营地：背包可以满，肚子可不能空。',
    asset: null, photoCategory: null,
  },
  {
    id: 'terraria', title: '泰拉瑞亚 · 史莱姆来访', kind: 'easter-egg',
    description: '草地上蹦来一只小史莱姆，旁边还有没打开的宝箱。这一小块冒险地留给《泰拉瑞亚》：先把家盖舒服，地下的宝藏可以明天再找。',
    asset: null, photoCategory: null,
  },
  {
    id: 'battlefieldv', title: '战地 V · 今日休整', kind: 'easter-egg',
    description: '旧式小吉普停在麦田旁，后座装满了野餐补给。给《战地风云5》留一张休整地图：今天没有战报，只有好天气，和一趟不用赶路的兜风。',
    asset: null, photoCategory: null,
  },
  {
    id: 'coding', title: '代码与橡皮鸭', kind: 'easter-egg',
    description: 'Water Sheep 的电脑旁多了一只小黄鸭。Bug 暂时没想明白，就先讲给它听。给学计算机的老队友留一个安静角落：保存一下，起来喝口水。',
    asset: null, photoCategory: null,
  },
  {
    id: 'picnic', title: '今天只管发呆', kind: 'easter-egg',
    description: '这次不用抢食堂了。草坡上的饭盒已经摆好，小收音机慢慢放着歌。给以后留一个轻松的小计划：找个好天气，一起吃点东西，再坐着发会儿呆。',
    asset: null, photoCategory: null,
  },
  {
    id: 'classphoto', title: '高中合照', dateLabel: '高中阶段',
    description: '同一间教室，同一段高中时光。把当时的我们，留在这一页。',
    asset: 'classphoto-landmark-v7.webp', illustration: 'illustrations/classphoto-v7.webp', photoCategory: 'campus',
  },
  {
    id: 'jinggangshan', title: '一起去井冈山', dateLabel: '2017年11月',
    description: '2017年11月，一起去井冈山。山间的风景，还有那时的我们。',
    asset: 'jinggangshan-landmark-v7.webp', illustration: 'illustrations/jinggangshan-v7.webp', photoCategory: 'journeys',
  },
  {
    id: 'reunion2023', title: '叙旧 · 2023年12月', dateLabel: '2023年12月',
    description: '2023年12月，叙旧时间。',
    asset: 'reunion-table.png', illustration: 'illustrations/reunion.webp', photoCategory: 'portraits',
  },
  {
    id: 'museum', title: '叙旧 · 深圳博物馆', dateLabel: '2024年8月',
    description: '2024年8月，深圳博物馆，叙旧时间。',
    asset: 'museum-landmark-v7.webp', illustration: 'illustrations/museum-v7.webp', photoCategory: 'exhibitions',
  },
  {
    id: 'sanguosha', title: '三国杀国战 · 宿舍开局', kind: 'easter-egg', dateLabel: '高中阶段',
    description: '高中时，经常在宿舍一起玩三国杀国战。亮将、出牌，再和老队友开一局。那张宿舍里的牌桌，也搬进了这座小岛。',
    asset: 'sanguosha-landmark-v7.webp', illustration: 'illustrations/sanguosha-v7.webp', photoCategory: null,
  },
  {
    id: 'hearthstone', title: '炉石传说 · 友谊赛', kind: 'easter-egg', dateLabel: '高中及以后',
    description: '高中时一起玩，后来也常常一起玩。熟悉的酒馆，熟悉的对手，点开友谊赛，又是和老朋友的一局。',
    asset: 'hearthstone-landmark-v7.webp', illustration: 'illustrations/hearthstone-v7.webp', photoCategory: null,
  },
  {
    id: 'love', title: '遇见猪猪', dateLabel: '2025年8月',
    description: '2025年8月，Water Sheep 找到了自己的猪猪。你们的伟大爱情，Violet 也有幸见证。祝你们一起开心很久很久。',
    asset: 'love-landmark-v7.webp', illustration: 'illustrations/love-v7.webp', photoCategory: null,
  },
  {
    id: 'fitness', title: '高中健身 · 留个纪念', dateLabel: '高中阶段',
    description: '高中时的健身，也值得在地图上留一格。翻到这张照片，又想起了那时的你。练过的日子，照片都记着。',
    asset: null, illustration: 'illustrations/fitness-v11.webp', artAlt: 'Water Sheep 在宿舍举哑铃，Violet 在旁边为他数数的水彩插画', photoCategory: 'campus',
    unlockText: '发现健身回忆：当年的照片，还在。',
  },
  {
    id: 'pe', title: '体育课 · 球场到泳池', dateLabel: '高中阶段',
    description: '篮球、足球，还有游泳，都是高中体育课的一部分。把球场和泳池放在同一格，也把那些一起上体育课的日子收好。',
    asset: null, illustration: 'illustrations/pe-v8.webp', photoCategory: null,
    unlockText: '体育课集合：篮球、足球、游泳，一个都不少。',
  },
  {
    id: 'physics', title: '这道物理题，教教我', kind: 'easter-egg', dateLabel: '高中阶段',
    description: '高中时，Water Sheep 教 Violet 做过物理题。把题目摊开，画一画受力，再一步步讲明白。题目未必还记得，你教我的这件事，一直记得。',
    asset: null, illustration: 'illustrations/physics-v8.webp', photoCategory: null,
    unlockText: '发现物理题彩蛋：这一题，有你讲。',
  },
  {
    id: 'guitar', title: '宿舍吉他 · Water Sheep', kind: 'easter-egg', dateLabel: '高中阶段',
    description: '宿舍里的 Water Sheep，也弹过吉他。这一格留给那把吉他，和当时在宿舍听你弹琴的回忆。',
    asset: null, illustration: 'illustrations/guitar-v8.webp', photoCategory: null,
    unlockText: '听见宿舍里的吉他声了。',
  },
].map((tile) => Object.freeze({ ...tile, ...MAP_LAYOUT[tile.id], isMemory: true })));

// Villages are encounters, not additional pages in the 33-memory collection.
export const VILLAGE_TILES = Object.freeze([
  { id: 'village-meadow', title: '草甸小村', effect: 'memory-cache', description: '炊烟升起的小村庄。第一次来访时，村民会送来一两处回忆的坐标。' },
  { id: 'village-watch', title: '风岗小村', effect: 'scout-ring', description: '村口有一座小小瞭望台。第一次来访时，村民会帮忙拨开周围更远的一圈迷雾。' },
  { id: 'village-river', title: '河湾小村', effect: 'memory-path', description: '熟悉山路的村民住在这里。第一次来访时，他们会指出通往最近一处未解锁回忆的小径。' },
  { id: 'village-orchard', title: '果园小村', effect: 'memory-cache', description: '果树下藏着村民的小礼物。第一次来访时，会收到一两处回忆的坐标。' },
  { id: 'village-hill', title: '山坡小村', effect: 'scout-ring', description: '从村口的山坡能看得更远。第一次来访时，村民会帮忙拨开周围更远的一圈迷雾。' },
].map(tile => Object.freeze({
  ...tile, ...MAP_LAYOUT[tile.id], isVillage: true, isMemory: false, asset: 'village-camp-v9.webp', photoCategory: null, unlockText: null,
})));

const memoriesByKey = new Map(MEMORY_TILES.map((tile) => [tileKey(tile), tile]));
const memoriesById = new Map(MEMORY_TILES.map(tile => [tile.id, tile]));
const villagesByKey = new Map(VILLAGE_TILES.map(tile => [tileKey(tile), tile]));
const LEGACY_VILLAGE_SEED = 0x6d2b79f5;

export function tileKey(position) {
  return `${position.q},${position.r}`;
}

export function isInside(q, r) {
  return Number.isInteger(q) && Number.isInteger(r)
    && Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= GRID_RADIUS;
}

export function hexPosition(q, r) {
  return {
    x: Math.sqrt(3) * TILE_SIZE * (q + r / 2),
    y: 1.5 * TILE_SIZE * r * 0.7,
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPosition(value, radius = GRID_RADIUS) {
  return isRecord(value) && Number.isInteger(value.q) && Number.isInteger(value.r)
    && Math.max(Math.abs(value.q), Math.abs(value.r), Math.abs(value.q + value.r)) <= radius;
}

function copyPosition(position) {
  return { q: position.q || 0, r: position.r || 0 };
}

function samePosition(first, second) {
  return first.q === second.q && first.r === second.r;
}

function areNeighbors(first, second) {
  const q = second.q - first.q;
  const r = second.r - first.r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === 1;
}

function allNeighbors(position) {
  return DIRECTIONS.map((direction) => ({ q: position.q + direction.q, r: position.r + direction.r }));
}

export function getNeighbors(position) {
  // A birthday landing just outside the map can still return to an inside cell.
  if (!isPosition(position, GRID_RADIUS + 1)) return [];
  return allNeighbors(position).filter(({ q, r }) => isInside(q, r));
}

function availableMoves(state) {
  if (state.steps >= MAX_STEPS) return [];
  if (state.steps === 24) return allNeighbors(state.position);
  const neighbors = getNeighbors(state.position);
  if (state.birthdayAt && !isInside(state.birthdayAt.q, state.birthdayAt.r)
    && areNeighbors(state.position, state.birthdayAt)) {
    neighbors.push(copyPosition(state.birthdayAt));
  }
  return neighbors;
}

export function getAvailableMoves(state) {
  const normalized = normalizeState(state);
  return normalized ? availableMoves(normalized) : [];
}

export function getVisibleKeys(state) {
  const normalized = normalizeState(state);
  if (!normalized) return [];
  const visible = new Set();
  if (normalized.steps >= 25) {
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q += 1) {
      for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r += 1) {
        if (isInside(q, r)) visible.add(tileKey({ q, r }));
      }
    }
    // Retain the exceptional cake cell even after the train returns inside.
    for (const point of normalized.trail) visible.add(tileKey(point));
  } else {
    for (const point of normalized.trail) {
      visible.add(tileKey(point));
      for (const neighbor of getNeighbors(point)) visible.add(tileKey(neighbor));
    }
    for (const reward of villageVisits(normalized)) {
      for (const key of reward.revealedKeys) visible.add(key);
      for (const id of reward.unlockedIds) visible.add(tileKey(memoriesById.get(id)));
    }
  }
  return [...visible];
}

export function getTile(position) {
  if (!isPosition(position, GRID_RADIUS + 1)) return null;
  return memoriesByKey.get(tileKey(position)) ?? villagesByKey.get(tileKey(position)) ?? {
    ...copyPosition(position), id: `scenery-${tileKey(position)}`, isMemory: false, isVillage: false,
    title: '沿途风景', description: '在这里停一停，再选一个喜欢的方向。',
    asset: null, photoCategory: null, unlockText: null,
  };
}

export function createInitialState() {
  const villageSeed = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] || LEGACY_VILLAGE_SEED
    : Math.floor(Math.random() * 0xffffffff) + 1;
  return {
    version: 2, steps: 0, position: { q: 0, r: 0 },
    visited: ['0,0'], trail: [{ q: 0, r: 0 }], birthdayAt: null,
    villageSeed,
  };
}

function normalizeState(candidate) {
  if (!isRecord(candidate)
    || candidate.version !== 2
    || !Number.isInteger(candidate.steps)
    || candidate.steps < 0 || candidate.steps > MAX_STEPS
    || !Array.isArray(candidate.trail)
    || candidate.trail.length !== candidate.steps + 1
    || !isPosition(candidate.position, candidate.steps >= 25 ? GRID_RADIUS + 1 : GRID_RADIUS)) return null;

  const trail = [];
  const visited = new Set();
  for (let index = 0; index < candidate.trail.length; index += 1) {
    const point = candidate.trail[index];
    // The 25th move can create one outside cake cell. Later moves may revisit
    // that exact cell, but no other outer cell can become part of the trail.
    if (!isPosition(point, GRID_RADIUS + 1)) return null;
    if (!isInside(point.q, point.r) && index !== 25
      && !(index > 25 && samePosition(point, trail[25]))) return null;
    if (index === 0 ? point.q !== 0 || point.r !== 0 : !areNeighbors(trail[index - 1], point)) return null;
    trail.push(copyPosition(point));
    visited.add(tileKey(point));
  }
  if (!samePosition(candidate.position, trail.at(-1))) return null;

  return {
    version: 2, steps: candidate.steps, position: copyPosition(trail.at(-1)),
    visited: [...visited], trail,
    birthdayAt: candidate.steps >= 25 ? copyPosition(trail[25]) : null,
    // Old v2 saves migrate consistently. Reward payloads are never trusted.
    villageSeed: Number.isInteger(candidate.villageSeed) && candidate.villageSeed > 0 && candidate.villageSeed <= 0xffffffff
      ? candidate.villageSeed : LEGACY_VILLAGE_SEED,
  };
}

export function move(state, destination) {
  if (!isPosition(destination, GRID_RADIUS + 1)) return state;
  const normalized = normalizeState(state);
  if (!normalized || !availableMoves(normalized).some((point) => samePosition(point, destination))) return state;

  const position = copyPosition(destination);
  const key = tileKey(position);
  const steps = normalized.steps + 1;
  return {
    version: 2, steps, position,
    visited: normalized.visited.includes(key) ? normalized.visited : [...normalized.visited, key],
    trail: [...normalized.trail, copyPosition(position)],
    birthdayAt: steps === 25 ? copyPosition(position) : normalized.birthdayAt,
    villageSeed: normalized.villageSeed,
  };
}

export function serializeState(state) {
  return JSON.stringify(normalizeState(state) ?? createInitialState());
}

export function restoreState(raw) {
  if (typeof raw !== 'string') return createInitialState();
  try {
    return normalizeState(JSON.parse(raw)) ?? createInitialState();
  } catch {
    return createInitialState();
  }
}

// Before the birthday, arrive or earn a village gift to open a memory.
// The 25th step opens every page without rewriting the physical travel history.
export function canInspectMemory(state, position) {
  const normalized = normalizeState(state);
  const tile = getTile(position);
  return Boolean(normalized && tile?.isMemory
    && (normalized.steps >= 25 || normalized.visited.includes(tileKey(position))
      || villageVisits(normalized).some(reward => reward.unlockedIds.includes(tile.id))));
}

function hexDistance(first, second) {
  return Math.max(Math.abs(first.q - second.q), Math.abs(first.r - second.r), Math.abs(first.q + first.r - second.q - second.r));
}

function villageRandom(seed, villageId) {
  let value = seed;
  for (const character of villageId) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ value >>> 15, value | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function secondRing(position) {
  const keys = [];
  for (let q = position.q - 2; q <= position.q + 2; q += 1) {
    for (let r = position.r - 2; r <= position.r + 2; r += 1) {
      if (isInside(q, r) && hexDistance(position, { q, r }) === 2) keys.push(tileKey({ q, r }));
    }
  }
  return keys;
}

function pathToMemory(origin, target) {
  let point = origin;
  const path = [tileKey(point)];
  while (!samePosition(point, target)) {
    point = getNeighbors(point).find(neighbor => hexDistance(neighbor, target) < hexDistance(point, target));
    path.push(tileKey(point));
  }
  return path;
}

// Replay only canonical travel data. Neither saved "visited" fields nor cached
// gift lists can make a village pay out, and querying this function never rolls.
function villageVisits(state) {
  const visits = [], claimed = new Set(), unlocked = new Set();
  for (let step = 0; step < state.trail.length && claimed.size < VILLAGE_TILES.length; step += 1) {
    const point = state.trail[step], key = tileKey(point);
    const memory = memoriesByKey.get(key);
    if (memory) unlocked.add(memory.id);
    const village = villagesByKey.get(key);
    if (!village || claimed.has(village.id)) continue;
    claimed.add(village.id);
    const reward = {
      villageId: village.id, step, title: village.title, description: '',
      unlockedIds: [], revealedKeys: [], effect: village.effect,
    };
    const candidates = MEMORY_TILES.filter(tile => !unlocked.has(tile.id));
    if (step >= 25) {
      reward.effect = 'celebration';
      reward.description = '全岛的回忆已经亮起。村民递来一杯热茶，也送上了生日祝福。';
    } else if (village.effect === 'scout-ring') {
      reward.revealedKeys = secondRing(point);
      reward.description = '村民登上瞭望台，为你拨开周围第二圈迷雾。新看见的建筑，等你走近再揭晓。';
    } else if (!candidates.length) {
      reward.effect = 'celebration';
      reward.description = '回忆坐标都已经收好。村民送上一路顺风的祝福，邀请你坐下来歇一歇。';
    } else if (village.effect === 'memory-cache') {
      const random = villageRandom(state.villageSeed, village.id);
      const count = Math.min(candidates.length, 1 + Math.floor(random() * 2));
      for (let index = 0; index < count; index += 1) {
        reward.unlockedIds.push(candidates.splice(Math.floor(random() * candidates.length), 1)[0].id);
      }
      reward.description = `村民送来 ${count} 枚回忆坐标。地图上相应的地块已经亮起，可以点击揭晓。`;
    } else {
      const target = candidates.reduce((nearest, tile) => hexDistance(point, tile) < hexDistance(point, nearest) ? tile : nearest);
      reward.unlockedIds = [target.id];
      reward.revealedKeys = pathToMemory(point, target);
      reward.description = '村民画出了一条通往最近回忆的小径。沿途迷雾已经拨开，终点的回忆也已解锁。';
    }
    for (const id of reward.unlockedIds) unlocked.add(id);
    visits.push(reward);
  }
  return visits;
}

export function getVillageVisits(state) {
  const normalized = normalizeState(state);
  return normalized ? villageVisits(normalized) : [];
}

export function getVillageArrival(previous, next) {
  const before = normalizeState(previous), after = normalizeState(next);
  if (!before || !after || after.steps !== before.steps + 1 || after.villageSeed !== before.villageSeed
    || !before.trail.every((point, index) => samePosition(point, after.trail[index]))) return null;
  if (!villagesByKey.has(tileKey(after.position)) || before.visited.includes(tileKey(after.position))) return null;
  return villageVisits(after).find(reward => reward.step === after.steps) ?? null;
}

// A single successful first arrival produces one memory popup. Revisits and
// camera / album actions do not create a new arrival.
export function getArrivalMemory(previous, next) {
  const before = normalizeState(previous), after = normalizeState(next);
  if (!before || !after || after.steps !== before.steps + 1
    || !before.trail.every((point, index) => samePosition(point, after.trail[index]))) return null;
  const tile = getTile(after.position);
  return tile?.isMemory && !before.visited.includes(tileKey(after.position)) ? tile : null;
}
