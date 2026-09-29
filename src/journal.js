import { createMemoryArt } from './memory-art.js';
import { createPhotoAlbum } from './photo-album.js';
import { MEMORY_TILES, canInspectMemory, getVisibleKeys, tileKey } from './exploration.js';

let journalCount = 0;

// A locked page never contains its illustration URL or memory text.
export function getJournalPages(state, filter = 'all', revealedIds = []) {
  const visible = new Set(getVisibleKeys(state));
  const read = new Set(revealedIds);
  const visited = new Set(state.trail?.map(tileKey) ?? []);
  return MEMORY_TILES.filter(tile => visible.has(tileKey(tile)))
    .filter(tile => filter === 'all' || (filter === 'eggs' ? tile.kind === 'easter-egg' : tile.kind !== 'easter-egg'))
    .map(tile => {
      const unlocked = canInspectMemory(state, tile);
      return { tile, unlocked, revealed: unlocked && (visited.has(tileKey(tile)) || read.has(tile.id)) };
    });
}

const envelope = `<svg viewBox="0 0 160 120" fill="none" aria-hidden="true"><path d="M27 36 78 17l55 21-4 65-103-3Z" fill="#ecd7ad" stroke="#b3986d" stroke-width="2"/><path d="m28 39 50 36 53-35" fill="#fff4d8" stroke="#b3986d" stroke-width="2"/><path d="m27 100 39-39m63 42L92 64" stroke="#b3986d" stroke-width="1.5"/><circle cx="79" cy="73" r="14" fill="#d8a078"/><path d="M74 72v-4a5 5 0 0 1 10 0v4m-11 0h12v9h-12z" stroke="#fff5df" stroke-width="2"/><path d="m18 19 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#e3be6a"/><path d="M137 81c16-8 16 10 0 11m0-11c2-15-13-10-8 3" stroke="#9da878" stroke-width="2"/></svg>`;

export function createJournal({ dialog, getState, asset, openDialog, onRead, onLocate, onBirthday, getPhotoStatus,
  onReveal, onOpen, onPhotoChange, onPreview }) {
  let filter = 'all';
  const revealedIds = new Set();
  const list = dialog.querySelector('#journal-list');
  const instanceId = ++journalCount;
  let tabs = dialog.querySelector('.journal-tabs');
  if (!tabs) {
    tabs = document.createElement('div');
    tabs.className = 'journal-tabs';
    dialog.querySelector('.journal-header').after(tabs);
  }
  const tabLabels = [['all', '全部小故事'], ['memories', '我们的回忆'], ['eggs', '兴趣小彩蛋'], ['photos', '照片']];
  for (const [name, label] of tabLabels) {
    if ([...tabs.querySelectorAll('[data-journal-filter]')].some(button => button.dataset.journalFilter === name)) continue;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.dataset.journalFilter = name;
    tab.textContent = label;
    tabs.append(tab);
  }
  const filters = [...tabs.querySelectorAll('[data-journal-filter]')];
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '收藏册分类');
  const photoPanel = document.createElement('div');
  photoPanel.className = 'journal-photos';
  photoPanel.id = `journal-photos-${instanceId}`;
  photoPanel.setAttribute('role', 'tabpanel');
  photoPanel.hidden = true;
  list.after(photoPanel);
  list.setAttribute('role', 'tabpanel');
  for (const button of filters) {
    button.id = `journal-tab-${instanceId}-${button.dataset.journalFilter}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', button.dataset.journalFilter === 'photos' ? photoPanel.id : list.id || 'journal-list');
  }
  photoPanel.setAttribute('aria-labelledby', filters.find(button => button.dataset.journalFilter === 'photos').id);
  const album = createPhotoAlbum({ mount: photoPanel, getState, onPhotoChange, onPreview });
  const revealBar = document.createElement('div');
  revealBar.className = 'journal-reveal-bar';
  revealBar.innerHTML = '<p>没拆过的信，留给你亲手打开。</p><button class="journal-reveal-all" type="button">✧ 一键全部揭开</button>';
  dialog.querySelector('.journal-header').after(revealBar);
  const revealAll = revealBar.querySelector('button');
  revealAll.addEventListener('click', () => {
    if (getState().steps < 25) return;
    const pending = getJournalPages(getState(), 'all', revealedIds).filter(page => page.unlocked && !page.revealed);
    pending.forEach(({ tile }) => revealedIds.add(tile.id));
    render();
    pending.forEach(({ tile }) => onReveal?.(tile));
  });
  const go = callback => { dialog.close(); callback(); };
  function render() {
    const state = getState();
    const photosSelected = filter === 'photos';
    dialog.classList.toggle('journal-dialog--photos', photosSelected);
    const pages = photosSelected ? [] : getJournalPages(state, filter, revealedIds);
    const allPages = getJournalPages(state, 'all', revealedIds);
    const earned = allPages.filter(page => page.revealed).length;
    dialog.querySelector('#journal-count').textContent = `${earned} / ${MEMORY_TILES.length}`;
    dialog.querySelector('#journal-count').setAttribute('aria-live', 'polite');
    revealBar.hidden = state.steps < 25 || photosSelected;
    revealAll.disabled = earned === MEMORY_TILES.length;
    revealAll.textContent = earned === MEMORY_TILES.length ? '✓ 每一页都揭开啦' : `✧ 一键全部揭开 · ${MEMORY_TILES.length - earned} 页`;
    dialog.querySelector('#journal-intro').textContent = photosSelected
      ? state.steps >= 25 ? '所有照片都收进来了。按分类慢慢翻，也可以点小照片跳到那一页。' : '走到的地方，照片也慢慢收进来。每一张，都在这本收藏册里。'
      : state.birthdayAt
      ? '地图全貌已展开。没看过的小故事还装在信封里，点一下，就能揭晓。'
      : '走到一处，贴上一幅画，也收好属于那里的照片。';
    filters.forEach(button => {
      const selected = button.dataset.journalFilter === filter;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-selected', String(selected));
      button.setAttribute('tabindex', selected ? '0' : '-1');
      if (selected && !photosSelected) list.setAttribute('aria-labelledby', button.id);
    });
    list.hidden = photosSelected;
    photoPanel.hidden = !photosSelected;
    dialog.querySelector('#journal-bottom-note').hidden = photosSelected;
    list.replaceChildren();
    if (photosSelected) { album.refresh(); return; }
    if (state.birthdayAt && filter === 'all') {
      const gift = document.createElement('button');
      gift.className = 'journal-birthday';
      gift.innerHTML = `<span class="journal-gift-icon" aria-hidden="true">✧</span><span><b>25 岁的这一站</b><small>给老队友的祝福，一直在这里。</small></span><span aria-hidden="true">↗</span>`;
      gift.addEventListener('click', () => go(onBirthday));
      list.append(gift);
    }
    pages.forEach(({ tile, unlocked, revealed }, index) => {
      const card = document.createElement('article');
      card.className = `keepsake-card${revealed ? '' : ' keepsake-locked'}${unlocked && !revealed ? ' keepsake-ready' : ''}`;
      card.dataset.buildingId = tile.id;
      card.dataset.revealed = String(revealed);
      card.style.setProperty('--paper-tilt', `${index % 2 ? 1 : -1}deg`);
      const visual = document.createElement(unlocked ? 'button' : 'div');
      visual.className = 'keepsake-art';
      const reveal = () => {
        const latest = getJournalPages(getState(), 'all', revealedIds).find(page => page.tile.id === tile.id);
        if (!latest?.unlocked || latest.revealed) return;
        revealedIds.add(tile.id); render();
        const updated = [...list.children].find(child => child.dataset.buildingId === tile.id);
        updated?.classList.add('keepsake-just-revealed');
        updated?.querySelector('.keepsake-art')?.focus({preventScroll:true});
        onReveal?.(tile);
      };
      if (revealed) {
        visual.setAttribute('aria-label', `${onPreview ? '放大插画' : '翻开插画'}：${tile.title}`);
        visual.classList.toggle('keepsake-art--heroes', Boolean(tile.heroPortraits));
        const artwork = createMemoryArt(tile, asset, {compact:true});
        visual.append(artwork);
        if (onPreview) {
          visual.classList.add('image-preview-trigger');
          visual.title = '点击放大，再次点击图片退出';
          visual.addEventListener('click', () => {
            if (dialog.open && canInspectMemory(getState(), tile)) onPreview(artwork, {label:tile.title,trigger:visual});
          });
        } else visual.addEventListener('click', () => go(() => onRead(tile)));
      } else {
        visual.innerHTML = envelope;
        const note = document.createElement('span'); note.textContent = unlocked ? '点一下，拆开小惊喜' : '等你来拆'; visual.append(note);
        if (unlocked) {
          visual.setAttribute('aria-label', `揭晓：${tile.title}`);
          visual.addEventListener('click', reveal);
        }
      }
      const copy = document.createElement('div'); copy.className = 'keepsake-copy';
      const meta = document.createElement('small'); meta.className = 'keepsake-meta';
      meta.textContent = revealed ? (tile.kind === 'easter-egg' ? '✦ 收集的小彩蛋' : '❀ 留住的小日子') : unlocked ? '✧ 可以揭晓 · 还没拆开' : '已发现 · 还没到访';
      if (tile.dateLabel) meta.textContent += ` · ${tile.dateLabel}`;
      const title = document.createElement('h3'); title.textContent = tile.title;
      const note = document.createElement('p'); note.className = 'keepsake-note';
      const photos = getPhotoStatus(state, tile.id);
      note.textContent = revealed ? `插画已贴好${photos.total ? ` · ${photos.unlocked} 张照片` : ''}` : unlocked ? '不用再走过去，点信封就能揭开。' : '让小列车来这一格，就能贴上插画。';
      const actions = document.createElement('div'); actions.className = 'keepsake-actions';
      if (unlocked) {
        const read = document.createElement('button'); read.className = 'keepsake-read';
        read.textContent = revealed ? '翻开这一页 ↗' : '亲手揭晓 ✧'; read.setAttribute('aria-label', `${revealed ? '翻开回忆' : '拆开信封'}：${tile.title}`);
        read.addEventListener('click', revealed ? () => go(() => onRead(tile)) : reveal); actions.append(read);
      }
      const locate = document.createElement('button'); locate.className = 'keepsake-locate';
      locate.textContent = unlocked ? '在地图上找它' : '去地图上找它 →';
      locate.setAttribute('aria-label', `在地图上看：${tile.title}`);
      locate.addEventListener('click', () => go(() => onLocate(tile))); actions.append(locate);
      copy.append(meta, title, note, actions); card.append(visual, copy); list.append(card);
    });
    const note = dialog.querySelector('#journal-bottom-note');
    note.textContent = allPages.length < MEMORY_TILES.length
      ? `雾里还有 ${MEMORY_TILES.length - allPages.length} 页小故事，慢慢找，不着急。`
      : earned === MEMORY_TILES.length ? '每一页都贴好了。以后想起，就回来翻翻。' : '还有没拆过的小信封，选一个喜欢的打开吧。';
    if (!pages.length) {
      const empty = document.createElement('p'); empty.className = 'journal-empty';
      empty.textContent = '这一叠还空着，去雾里找找吧。'; list.append(empty);
    }
  }
  function selectTab(next, options = {}) {
    filter = tabLabels.some(([name]) => name === next) ? next : 'all';
    album.close();
    render();
    if (filter === 'photos') album.open(options);
    dialog.scrollTop = 0;
  }
  filters.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (filter === button.dataset.journalFilter) return;
      selectTab(button.dataset.journalFilter);
      onOpen?.({ tab: filter });
    });
    button.addEventListener('keydown', event => {
      const nextIndex = event.key === 'ArrowRight' ? (index + 1) % filters.length
        : event.key === 'ArrowLeft' ? (index + filters.length - 1) % filters.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? filters.length - 1 : null;
      if (nextIndex === null) return;
      event.preventDefault();
      event.stopPropagation();
      const next = filters[nextIndex];
      selectTab(next.dataset.journalFilter);
      next.focus({ preventScroll: true });
      onOpen?.({ tab: filter });
    });
  });
  dialog.addEventListener('close', () => { if (!dialog.open) album.close(); });
  return {
    open(options = {}) {
      const { tab = 'all', ...photoOptions } = options ?? {};
      selectTab(tab, photoOptions);
      openDialog(dialog);
      filters.find(button => button.dataset.journalFilter === filter)?.focus({ preventScroll: true });
      dialog.scrollTop = 0;
      onOpen?.({ tab: filter });
    },
    remember(tile) { if (canInspectMemory(getState(), tile)) revealedIds.add(tile.id); },
    reset() { revealedIds.clear(); filter = 'all'; album.close(); list.replaceChildren(); },
    close() { album.close(); if (dialog.open) dialog.close(); },
    refresh() { render(); },
  };
}
