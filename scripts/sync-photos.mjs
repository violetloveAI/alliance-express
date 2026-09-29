import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PHOTOS } from '../src/photos.js';
import { MEMORY_TILES } from '../src/exploration.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowedIgnored = name => name === '.DS_Store' || name === '.building.json' || /\.md$/i.test(name);

export async function collectAssignments(directory) {
  const byOriginal = new Map(PHOTOS.map(photo => [photo.original.normalize('NFC'), photo]));
  const knownBuildings = new Set(MEMORY_TILES.map(building => building.id));
  const assignments = { version: 1, buildings: Object.fromEntries(MEMORY_TILES.map(building => [building.id, []])), birthday: [] };
  const warnings = [], errors = [], seenBuildings = new Map(), occurrences = new Map();
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { throw new Error(`无法读取照片目录：${directory}（${error.code ?? error.message}）`); }

  async function collectFiles(folder, buildingId, ids) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (allowedIgnored(entry.name)) continue;
      const file = join(folder, entry.name);
      if (entry.isSymbolicLink()) { errors.push(`不支持快捷链接，请复制原始照片：${file}`); continue; }
      if (entry.isDirectory()) { await collectFiles(file, buildingId, ids); continue; }
      if (!entry.isFile()) { errors.push(`无法识别的目录内容：${file}`); continue; }
      const photo = byOriginal.get(entry.name.normalize('NFC'));
      if (!photo) { errors.push(`未知照片「${entry.name}」：${file}。请保留已登记照片的原名；新照片需先加入 src/photos.js。`); continue; }
      if (ids.has(photo.id)) { errors.push(`同一建筑 ${buildingId} 内出现重复照片「${entry.name}」，请只保留一份。`); continue; }
      ids.add(photo.id);
      const groups = occurrences.get(photo.id) ?? [];
      groups.push(buildingId); occurrences.set(photo.id, groups);
    }
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))) {
    if (allowedIgnored(entry.name)) continue;
    const folder = join(directory, entry.name);
    if (!entry.isDirectory()) { errors.push(`照片应放在带 .building.json 的建筑子目录内：${folder}`); continue; }
    let metadata;
    try { metadata = JSON.parse(await readFile(join(folder, '.building.json'), 'utf8')); }
    catch (error) {
      errors.push(error.code === 'ENOENT' ? `目录缺少 .building.json：${folder}` : `目录的 .building.json 无法解析：${folder}`);
      continue;
    }
    const id = metadata?.buildingId;
    if (typeof id !== 'string' || (!knownBuildings.has(id) && id !== 'birthday')) { errors.push(`未知建筑 ID「${String(id)}」：${folder}`); continue; }
    if (seenBuildings.has(id)) { errors.push(`重复建筑 ID「${id}」：${seenBuildings.get(id)} 与 ${folder}`); continue; }
    seenBuildings.set(id, folder);
    const ids = new Set(); await collectFiles(folder, id, ids);
    const ordered = PHOTOS.filter(photo => ids.has(photo.id)).map(photo => photo.id);
    if (id === 'birthday') assignments.birthday = ordered;
    else assignments.buildings[id] = ordered;
  }

  if (errors.length) throw new Error(`照片同步未写入，发现 ${errors.length} 个问题：\n${errors.map(error => `- ${error}`).join('\n')}`);
  for (const [id, groups] of occurrences) if (groups.length > 1) warnings.push(`跨目录复用 ${id}：${groups.join('、')}。到访其中任一分配建筑即可解锁。`);
  const unassigned = PHOTOS.filter(photo => !occurrences.has(photo.id));
  if (unassigned.length) warnings.push(`未分配照片 ${unassigned.length} 张：${unassigned.map(photo => photo.original).join('、')}。它们不会在游戏中展示；放回任一建筑或生日目录并同步后恢复。`);
  const absent = [...knownBuildings].filter(id => !seenBuildings.has(id));
  if (absent.length) warnings.push(`未找到 ${absent.length} 个建筑目录，按空照片组保存：${absent.join('、')}。`);
  return { assignments, warnings };
}

export async function syncPhotos({ directory = join(projectRoot, '特殊建筑照片'), outputPath = join(projectRoot, 'src/photo-assignments.json') } = {}) {
  const result = await collectAssignments(directory);
  await writeFile(outputPath, `${JSON.stringify(result.assignments, null, 2)}\n`, 'utf8');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { assignments, warnings } = await syncPhotos();
    const count = new Set([...Object.values(assignments.buildings).flat(), ...assignments.birthday]).size;
    console.log(`照片分配已同步：${MEMORY_TILES.length} 个建筑 + 生日组，${count} 张已分配照片。原图未改动。`);
    for (const warning of warnings) console.warn(`提示：${warning}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
