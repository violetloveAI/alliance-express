import { createMemoryArt } from './memory-art.js';
import { canInspectMemory, getTile, getVillageVisits, serializeState, tileKey, MEMORY_TILES, VILLAGE_TILES } from './exploration.js';

const memoryNotes = {
  school: '回到故事开始的地方。两年半的舍友，成了好多年的老队友。',
  canteen: '热饭端上桌，老队友坐在对面。平常的一顿，也值得记下来。',
  dorm: '宿舍里的烧烤和游戏，都有人陪。队伍里的那个名字，一直很熟悉。',
  metro: '这一站，龙华方向。放学后的路，正好可以一起走。',
  walk: '吃完饭再走走。有一句没一句地聊，时间就慢下来了。',
  shenzhen: '电影开场了，旁边的位置留给老队友。又攒下一次一起出门。',
  hainan: '隔着海南和广东，那通很长的语音，把两边的日子连了起来。',
  guangdong: '那时各在一座城。再见的时候，还是熟悉的我们。',
  foshan: '翻到佛山这一页。风景留在照片里，同行的人留在心里。',
  fuzhou: '走进你读研的城市。福州的这一程，又有我们一起。',
  zhangzhou: '在漳州停一停，多留几张合照。以后还可以一起翻。',
  reunion: '又坐到一桌，聊聊最近。久一点没见，也不妨碍熟悉。',
  alliance: '秦与高卢，再续一回合。这份老队友同盟，今天也有效。',
  honor: '熟悉的队友上线了。那些一起开局的晚上，仍在这一页。',
  supply: '补给已经备好。下一顿饭和下一程，都给老队友留了位置。',
  badminton: '球拍拿好，开心开打。愿新的一岁，好球和好心情都多一些。',
  battlefield2042: '机器狗在值班，零食也已补齐。和老队友一起，继续出发。',
  dontstarve: '天黑以前添一把柴。篝火亮着，今晚就安心吃饱。',
  terraria: '小史莱姆来串门了。先把家盖舒服，宝藏可以慢慢找。',
  battlefieldv: '吉普停在麦田边。今天的任务，是吃点东西，好好休息。',
  coding: '先保存，再喝口水。难题讲给小黄鸭听，也记得照顾自己。',
  picnic: '饭盒摆好了，歌也放着。找个好天气，一起发会儿呆。',
  classphoto: '同一间教室，同一段高中时光。那时的我们，留在合照里。',
  jinggangshan: '山间的风吹过来，又想起那次井冈山同行。',
  reunion2023: '2023 年末，又见面了。把近况聊完，再约下一次。',
  museum: '在深圳博物馆边走边聊。看了展，也好好叙了旧。',
  sanguosha: '宿舍里的牌桌又开局。亮将、出牌，身边还是老队友。',
  hearthstone: '酒馆门开着，友谊赛也开着。熟悉的对手，值得再来一局。',
  love: '这一页留给你和猪猪。愿你们一起开心，很久很久。',
  fitness: '那时练过的日子，照片都记着。新的一岁，也要身体棒棒。',
  pe: '从球场跑到泳池。那些一起上的体育课，也一起收好。',
  physics: '题目摊开，受力图画好。谢谢你当年一步一步讲给我听。',
  guitar: '宿舍里的吉他又响起来。那把琴，和当时听琴的日子，都在。',
};

const sceneryNotes = [
  ['顺着风走', '这一回合没有大事。吹到一点风，也算今天的小收获。'],
  ['路边的小花', '路边开了几朵小花。慢一点，刚好可以看见。'],
  ['把脚步放轻', '不用赶下一站。和老队友慢慢走，这一格也很好。'],
  ['云朵经过', '一朵云从头顶路过。愿烦心事也这样，轻轻飘过去。'],
  ['晒一会儿太阳', '阳光刚刚好。在这里歇一歇，给好心情充点电。'],
  ['听见树叶响', '树叶沙沙响。说点近况，或者安静一会儿，都舒服。'],
  ['收下一片绿', '今天又多走了一小段。把眼前这片绿，也放进回忆里。'],
  ['留一点空白', '这一格没有安排。留给发呆，也留给临时想起的小愿望。'],
  ['拐个弯看看', '随手选的方向，也有可爱的风景。下个路口，继续一起。'],
  ['走到水边', '远处的水亮了一下。愿新的一岁，也常有这样的小惊喜。'],
  ['给自己歇一歇', '先把肩膀放松。今天走到这里，已经很不错了。'],
  ['普通的好日子', '没有特别的故事，只是好好走过了一回合。这样就很好。'],
];

const revisitNotes = [
  '又走到这里了。熟悉的地方，今天也有新一点的心情。',
  '绕一圈再回来，风景还是亲切。老地方，值得多停一会儿。',
  '这一格我们来过。路可以重复，一起走的日子却都是新的。',
  '再看一眼，好像又发现一点可爱。慢慢逛，从来不算绕远。',
  '回头也有好风景。想来就来，老队友的位置一直留着。',
  '又在这里碰面。没有新任务，就把这一小段轻松收好。',
  '熟悉的路再走一遍，也很好。今天的陪伴，多记上一回合。',
  '走走停停，又回到这一站。有些地方，就是愿意一来再来。',
];

const villagesByKey = new Map(VILLAGE_TILES.map(village => [tileKey(village), village]));
const memoriesById = new Map(MEMORY_TILES.map(tile => [tile.id, tile]));
const passingTrainArt = 'illustrations/passing-train-v10.webp';

// The timeline keeps a short caption; the village popup retains the full effect explanation.
function villageCaption(village) {
  if (village.effect === 'memory-cache') return `村民送来 ${village.unlockedIds.length} 枚回忆坐标，点亮的地块可以揭晓了。`;
  if (village.effect === 'scout-ring') return '视野多亮一圈，又能看见更远的风景了。';
  if (village.effect === 'memory-path') return '村民指了条小路，沿途迷雾和终点回忆一起打开。';
  return '收下一杯热茶，和村民的一路顺风。';
}

// Replay validation belongs to the exploration model. In particular, album
// access, revealed terrain and the birthday's global unlock are not visits.
export function getTimelineEntries(state, discoveries = []) {
  const journey = JSON.parse(serializeState(state));
  const villageVisits = new Map(getVillageVisits(journey).map(visit => [visit.step, visit]));
  const visits = new Map([['0,0', 1]]);
  const firstVisits = new Map();
  journey.trail.forEach((point, step) => {
    const key = tileKey(point);
    if (!firstVisits.has(key)) firstVisits.set(key, step);
  });
  const entries = journey.trail.slice(1).flatMap((point, index) => {
    const step = index + 1;
    const position = { q: point.q, r: point.r };
    const key = tileKey(position);
    const visitCount = (visits.get(key) ?? 0) + 1;
    visits.set(key, visitCount);
    const place = getTile(position);
    const tile = place?.isMemory ? place : undefined;
    const villageTile = villagesByKey.get(key);
    const village = villageVisits.get(step);
    const sceneryIndex = (Math.abs(point.q * 13 + point.r * 7) + step * 3) % sceneryNotes.length;
    let [title, text] = sceneryNotes[sceneryIndex];
    let kind = 'scenery';

    if (visitCount > 1) {
      title = tile ? `再到 · ${tile.title}` : villageTile ? `再访 · ${villageTile.title}` : '在熟悉的路上';
      text = revisitNotes[(visitCount - 2) % revisitNotes.length];
      kind = 'revisit';
    } else if (tile) {
      title = tile.title;
      text = memoryNotes[tile.id] ?? tile.unlockText ?? '在这里停一停，把这一段小故事好好收下。';
      kind = tile.kind === 'easter-egg' ? 'easter-egg' : 'memory';
    } else if (village) {
      title = village.title;
      text = villageCaption(village);
      kind = 'village';
    }

    const arrival = { id: `move:${step}`, step, title, text, position, kind, visitCount,
      ...(tile ? { tile } : {}), ...(village ? { village } : {}), ...(villageTile ? { villageTile } : {}) };
    if (step !== 25) return [arrival];
    const birthday = {
      id: `move:${step}`, step, position: { ...position }, kind: 'birthday',
      title: '25 岁，生日快乐',
      text: '小列车停在蛋糕旁。新的一岁，继续和老队友同行。',
    };
    return tile || villageTile ? [birthday, { ...arrival, id: `arrival:${step}` }] : [birthday];
  });

  // Explicit reveals are supplied by this session's reader. Validate against the
  // prefix at the event's own turn, so later birthday access cannot backdate it.
  const validEvents = (Array.isArray(discoveries) ? discoveries : []).filter(event =>
    event && Number.isInteger(event.step) && event.step >= 0 && event.step <= journey.steps
    && typeof event.memoryId === 'string' && event.id === `reveal:${event.memoryId}`
    && memoriesById.has(event.memoryId)).sort((a, b) => a.step - b.step);
  const revealed = new Set();
  for (const event of validEvents) {
    const tile = memoriesById.get(event.memoryId);
    if (revealed.has(tile.id) || (firstVisits.get(tileKey(tile)) ?? Infinity) <= event.step) continue;
    const prefix = { ...journey, steps: event.step, position: journey.trail[event.step], trail: journey.trail.slice(0, event.step + 1) };
    if (!canInspectMemory(prefix, tile)) continue;
    revealed.add(tile.id);
    entries.push({
      id: event.id, step: event.step, kind: 'reveal', title: tile.title,
      text: memoryNotes[tile.id] ?? tile.unlockText ?? '翻开这一页，给今天多留下一段小故事。',
      position: { q: tile.q, r: tile.r }, tile,
    });
  }
  // A stable sort keeps the move (and any birthday arrival) ahead of reveals.
  entries.sort((a, b) => a.step - b.step);
  const counts = new Map(), indices = new Map();
  for (const entry of entries) counts.set(entry.step, (counts.get(entry.step) ?? 0) + 1);
  return entries.map(entry => {
    const recordIndex = (indices.get(entry.step) ?? 0) + 1;
    indices.set(entry.step, recordIndex);
    return { ...entry, recordIndex, recordCount: counts.get(entry.step) };
  });
}

const kindLabels = {
  memory: '收好一段回忆', 'easter-egg': '遇见一个小彩蛋',
  scenery: '沿途的小日子', revisit: '熟悉的地方，再来一次',
  village: '村庄送来小礼物', birthday: '这一岁的特别回合', reveal: '这一回合，揭晓了回忆',
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createTimeline({ getState, getDiscoveries = () => [], asset, openDialog, onRead, onLocate, onOpen = () => {}, onPreview }) {
  const dialog = element('dialog', 'timeline-dialog');
  dialog.id = 'timeline-dialog';
  dialog.setAttribute('aria-labelledby', 'timeline-title');
  dialog.innerHTML = `<button type="button" class="dialog-close timeline-close" aria-label="收好历史年表">×</button>
    <header class="timeline-header"><div><p class="eyebrow">OUR LITTLE HISTORY</p><h2 id="timeline-title">这一路的<span>历史年表</span></h2><p class="timeline-intro">有的回合，留下一幅画；有的回合，攒下好几个小故事。</p></div><div class="timeline-seal"><span>本次漫游</span><strong class="timeline-count">0 回合</strong><span class="timeline-record-count">0 个片段</span></div></header>
    <div class="timeline-toolbar"><span class="timeline-origin">起点 · 深圳实验学校</span><button type="button" class="timeline-latest">到最新一回合 <span aria-hidden="true">→</span></button></div>
    <div class="timeline-viewport" tabindex="0" role="region" aria-label="本局历史年表，可左右滑动或使用左右方向键"><ol class="timeline-track" aria-label="按回合排列的旅途记录"></ol><div class="timeline-empty" hidden><div class="timeline-empty-art"></div><h3>这一卷，等我们慢慢写</h3><p>小列车还在起点。<br>走出第一步，就留下第一张回合卡。</p></div></div>
    <footer class="timeline-footer"><button type="button" class="timeline-prev" aria-label="查看较早的回合">← <span>往前翻</span></button><p class="timeline-scroll-note">左右滑动，慢慢看</p><button type="button" class="timeline-next" aria-label="查看较新的回合"><span>往后翻</span> →</button></footer>`;
  document.body.append(dialog);

  const viewport = dialog.querySelector('.timeline-viewport');
  const track = dialog.querySelector('.timeline-track');
  const empty = dialog.querySelector('.timeline-empty');
  const previous = dialog.querySelector('.timeline-prev');
  const next = dialog.querySelector('.timeline-next');
  const latest = dialog.querySelector('.timeline-latest');
  function illustration(file, alt) {
    const img = element('img');
    img.src = asset(file); img.alt = alt;
    img.loading = 'lazy'; img.decoding = 'async'; img.width = 512; img.height = 512;
    return img;
  }
  const emptyArtwork = illustration(passingTrainArt, 'Violet 和 Water Sheep 坐着小火车准备出发');
  const emptyFrame = empty.querySelector('.timeline-empty-art');
  if (onPreview) {
    const preview = element('button', 'timeline-empty-preview image-preview-trigger');
    preview.type = 'button';
    preview.setAttribute('aria-label', '放大插画：小列车准备出发');
    preview.title = '点击放大，再次点击图片退出';
    preview.append(emptyArtwork);
    preview.addEventListener('click', () => {
      if (dialog.open && !empty.hidden) onPreview(emptyArtwork, {label:'小列车准备出发',trigger:preview});
    });
    emptyFrame.append(preview);
  } else emptyFrame.append(emptyArtwork);
  let opener;
  let pointerStartedOutside = false;
  let scrollFrame = 0;

  function close() { if (dialog.open) dialog.close(); }
  function go(callback, value) {
    close();
    callback?.(value);
  }

  function renderCard(entry) {
    const turn = element('li', `timeline-turn timeline-turn--${entry.kind}`);
    turn.dataset.step = entry.step;
    turn.dataset.recordId = entry.id;
    turn.dataset.recordIndex = entry.recordIndex;
    turn.dataset.recordCount = entry.recordCount;
    const ruler = element('div', 'timeline-ruler');
    const turnLabel = `第 ${String(entry.step).padStart(2, '0')} 回合${entry.recordCount > 1 ? ` · 片段 ${entry.recordIndex}` : ''}`;
    ruler.append(element('span', 'timeline-turn-number', turnLabel), element('i', 'timeline-dot'));
    const card = element('article', 'timeline-card');
    const art = element(onPreview ? 'button' : 'div', 'timeline-art');
    if (entry.kind === 'birthday' || entry.villageTile) {
      art.append(illustration(
        entry.kind === 'birthday' ? 'birthday-station.webp' : (entry.villageTile.asset ?? 'village-camp-v9.webp'),
        entry.kind === 'birthday' ? 'Water Sheep 和 Violet 在生日车站一起庆祝' : '路边的小村庄和为旅人准备的礼物',
      ));
    } else if (entry.tile) {
      art.classList.toggle('timeline-art--heroes', Boolean(entry.tile.heroPortraits));
      art.append(createMemoryArt(entry.tile, asset, { compact: true }));
    } else {
      art.classList.add('timeline-art--passing');
      art.append(illustration(passingTrainArt, 'Violet 和 Water Sheep 坐着小火车，从沿途风景间匆匆经过'));
    }

    if (onPreview) {
      art.type = 'button';
      art.classList.add('image-preview-trigger');
      art.setAttribute('aria-label', `放大插画：${entry.title}`);
      art.title = '点击放大，再次点击图片退出';
      const artwork = art.children[0];
      art.addEventListener('click', () => {
        if (dialog.open) onPreview(artwork, {label:entry.title,trigger:art});
      });
    }
    const copy = element('div', 'timeline-copy');
    copy.append(element('p', 'timeline-kind', kindLabels[entry.kind]), element('h3', '', entry.title), element('p', 'timeline-note', entry.text));
    const actions = element('div', 'timeline-card-actions');
    if (entry.tile && onRead) {
      const read = element('button', 'timeline-read', '翻开这段回忆 ↗');
      read.type = 'button'; read.setAttribute('aria-label', `翻开第 ${entry.step} 回合的回忆：${entry.tile.title}`);
      read.addEventListener('click', () => go(onRead, entry.tile));
      actions.append(read);
    }
    if (onLocate) {
      const locate = element('button', 'timeline-locate', '在地图上看看');
      locate.type = 'button'; locate.setAttribute('aria-label', `在地图上看第 ${entry.step} 回合的位置`);
      locate.addEventListener('click', () => go(onLocate, entry.position));
      actions.append(locate);
    }
    copy.append(actions); card.append(art, copy); turn.append(ruler, card);
    return turn;
  }

  function updateNavigation() {
    const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    previous.disabled = viewport.scrollLeft < 2;
    next.disabled = viewport.scrollLeft >= maximum - 2;
    latest.disabled = !track.children.length || next.disabled;
  }
  function scrollTo(left) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({ left, behavior: reducedMotion ? 'auto' : 'smooth' });
  }
  function page(direction) {
    const first = track.firstElementChild;
    const following = first?.nextElementSibling;
    const distance = following ? following.offsetLeft - first.offsetLeft : (first?.getBoundingClientRect().width ?? viewport.clientWidth);
    scrollTo(viewport.scrollLeft + direction * distance);
  }
  previous.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));
  latest.addEventListener('click', () => scrollTo(viewport.scrollWidth));
  dialog.querySelector('.timeline-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('pointerdown', event => {
    const bounds = dialog.getBoundingClientRect();
    pointerStartedOutside = event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
  });
  dialog.addEventListener('click', event => {
    if (pointerStartedOutside && event.target === dialog) close();
    pointerStartedOutside = false;
  });
  dialog.addEventListener('close', () => {
    cancelAnimationFrame(scrollFrame);
    if (!document.querySelector('dialog[open]') && opener?.isConnected) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); page(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); scrollTo(event.key === 'Home' ? 0 : viewport.scrollWidth);
    }
  });
  viewport.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(updateNavigation);
  }, { passive: true });
  window.addEventListener('resize', () => { if (dialog.open) updateNavigation(); });

  return {
    open() {
      if (dialog.open) return;
      const entries = getTimelineEntries(getState(), getDiscoveries());
      track.replaceChildren(...entries.map(renderCard));
      empty.hidden = entries.length > 0;
      track.hidden = entries.length === 0;
      dialog.querySelector('.timeline-count').textContent = `${entries.at(-1)?.step ?? 0} 回合`;
      dialog.querySelector('.timeline-record-count').textContent = `${entries.length} 个片段`;
      dialog.querySelector('.timeline-scroll-note').textContent = entries.length ? '左右滑动，慢慢看' : '从这里出发，慢慢走';
      opener = document.activeElement;
      if (openDialog) openDialog(dialog);
      else dialog.showModal();
      onOpen();
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
      updateNavigation();
    },
    close,
  };
}
