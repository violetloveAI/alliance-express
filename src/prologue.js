const STORY = [
  {
    file: '01-game.webp',
    heading: '一张突然出现的车票',
    caption: 'Water Sheep 正打着游戏，一张写着「神秘国度」的火车票，忽然出现在他眼前。',
    dialogue: '再来一回合……咦？',
    alt: 'Water Sheep 玩游戏时，发现了一张闪着微光的神秘火车票',
  },
  {
    file: '02-invitation.webp',
    heading: '老队友，一起去吗？',
    caption: '他第一时间找到了 Violet。这张车票刚好能带两个人，去一个从没到过的地方。',
    dialogue: 'Violet，这次一起去个新地方。',
    alt: 'Water Sheep 拿着神秘车票，邀请老队友 Violet 一起旅行',
  },
  {
    file: '03-boarding.webp',
    heading: '两个人的小列车',
    caption: 'Violet 踏上绿色小列车。Water Sheep 伸出手，把老队友接上车。',
    dialogue: '来啦，老队友！',
    alt: 'Violet 登上绿色的小列车，Water Sheep 在车上迎接她',
  },
  {
    file: '04-journey.webp',
    heading: '下一站，神秘国度',
    caption: '汽笛轻响，小列车穿过云雾。那些一起走过的风景，正藏在前方的小岛里。',
    dialogue: '下一站，神秘国度。',
    alt: 'Water Sheep 和 Violet 坐着绿色小列车，穿过云雾驶入神秘国度',
  },
];

let instanceCount = 0;

function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(action, className, label) {
  const element = node('button', className, label);
  element.type = 'button';
  element.dataset.prologueAction = action;
  return element;
}

export function createPrologue({
  onComplete = () => {},
  baseUrl = import.meta.env?.BASE_URL ?? '/',
  interval = 5500,
} = {}) {
  const id = `prologue-${++instanceCount}`;
  const dialog = node('dialog', 'prologue');
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  const book = node('div', 'prologue__book');
  const header = node('header', 'prologue__header');
  const title = node('h2', 'prologue__title', '一张车票的奇遇');
  title.id = `${id}-title`;
  const skip = button('skip', 'prologue__skip', '跳过故事');
  header.append(node('p', 'prologue__eyebrow', '同盟漫游记 · 序章'), title, skip);

  let active = false;
  let page = 0;
  let paused = false;
  let timer = null;
  let deadline = 0;
  let remaining = interval;
  let timerRevision = 0;
  let presentation = 0;
  let opener = null;
  const loaded = new Set();
  const now = () => window.performance?.now() ?? Date.now();
  const stage = node('div', 'prologue__stage');
  const slides = STORY.map((story, index) => {
    const slide = node('section', 'prologue__slide');
    slide.dataset.page = String(index + 1);
    slide.setAttribute('aria-labelledby', `${id}-page-${index}`);
    slide.hidden = true;
    const art = node('figure', 'prologue__art');
    const image = node('img', 'prologue__image');
    image.alt = story.alt;
    image.decoding = 'async';
    image.draggable = false;
    image.fetchPriority = index === 0 ? 'high' : 'auto';
    const fallback = node('div', 'prologue__image-fallback', '一张车票，两位老队友。');
    fallback.setAttribute('aria-hidden', 'true');
    fallback.hidden = true;
    const settle = (success) => {
      if (loaded.has(index)) return;
      loaded.add(index);
      image.hidden = !success;
      fallback.hidden = success;
      slide.dataset.imageState = success ? 'loaded' : 'error';
      if (active && index === page) updatePlayback();
    };
    image.addEventListener('load', () => settle(true));
    image.addEventListener('error', () => settle(false));
    image.src = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}assets/prologue/${story.file}`;
    if (image.complete) settle(image.naturalWidth > 0);
    art.append(image, fallback, node('p', 'prologue__dialogue', story.dialogue));
    const copy = node('div', 'prologue__copy');
    const heading = node('h3', 'prologue__heading', story.heading);
    heading.id = `${id}-page-${index}`;
    copy.append(node('p', 'prologue__chapter', `序章 · ${String(index + 1).padStart(2, '0')} / 04`), heading, node('p', 'prologue__caption', story.caption));
    slide.append(art, copy);
    stage.append(slide);
    return slide;
  });

  const controls = node('footer', 'prologue__controls');
  const previous = button('previous', 'prologue__previous', '上一页');
  const pagination = node('div', 'prologue__pagination');
  pagination.setAttribute('role', 'group');
  pagination.setAttribute('aria-label', '故事页码');
  const dots = STORY.map((story, index) => {
    const dot = button(`page-${index}`, 'prologue__dot', String(index + 1).padStart(2, '0'));
    dot.setAttribute('aria-label', `第 ${index + 1} 页：${story.heading}`);
    dot.addEventListener('click', () => goTo(index));
    pagination.append(dot);
    return dot;
  });
  const pause = button('pause', 'prologue__pause', '暂停播放');
  const next = button('next', 'prologue__next', '下一页');
  const status = node('p', 'prologue__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  controls.append(previous, pagination, pause, next);
  book.append(header, stage, controls, status);
  dialog.append(book);
  document.body.append(dialog);

  function cancelTimer(preserveRemaining = false) {
    if (timer !== null) {
      if (preserveRemaining) remaining = Math.max(0, deadline - now());
      window.clearTimeout(timer);
      timer = null;
    }
    timerRevision += 1;
  }

  function updatePlayback() {
    const playing = active && !paused && !document.hidden;
    dialog.dataset.playback = playing ? 'playing' : 'paused';
    dialog.dataset.imageReady = String(loaded.has(page));
    pause.textContent = paused ? '自动播放' : '暂停播放';
    pause.setAttribute('aria-label', paused ? '开启故事自动播放' : '暂停故事自动播放');
    pause.setAttribute('aria-pressed', String(paused));
    if (!playing || !loaded.has(page) || timer !== null) return;
    const currentPresentation = presentation;
    const currentTimer = ++timerRevision;
    deadline = now() + remaining;
    timer = window.setTimeout(() => {
      if (!active || presentation !== currentPresentation || timerRevision !== currentTimer) return;
      timer = null;
      advance();
    }, remaining);
  }

  function goTo(index) {
    if (!active || index < 0 || index >= STORY.length) return;
    cancelTimer();
    remaining = interval;
    page = index;
    dialog.dataset.page = String(page + 1);
    slides.forEach((slide, slideIndex) => {
      slide.hidden = slideIndex !== page;
      slide.dataset.state = slideIndex === page ? 'active' : 'inactive';
      dots[slideIndex].setAttribute('aria-current', slideIndex === page ? 'step' : 'false');
    });
    // Keep this control focusable when returning to page one.
    previous.setAttribute('aria-disabled', String(page === 0));
    next.textContent = page === STORY.length - 1 ? '抵达第一站' : '下一页';
    status.textContent = `第 ${page + 1} 页，共 ${STORY.length} 页。${STORY[page].heading}`;
    updatePlayback();
  }

  function advance() {
    if (!active) return;
    if (page === STORY.length - 1) finish();
    else goTo(page + 1);
  }

  function visibilityChanged() {
    if (!active) return;
    if (document.hidden) cancelTimer(true);
    updatePlayback();
  }

  function hide({ restoreFocus = true } = {}) {
    const target = opener;
    opener = null;
    active = false;
    cancelTimer();
    const closedPresentation = ++presentation;
    document.removeEventListener('visibilitychange', visibilityChanged);
    dialog.dataset.playback = 'paused';
    if (dialog.open) dialog.close();
    if (restoreFocus) window.requestAnimationFrame(() => {
      if (presentation === closedPresentation && !active && target?.isConnected
        && typeof target.focus === 'function') target.focus({ preventScroll: true });
    });
  }

  function finish() {
    if (!active) return;
    hide({ restoreFocus: false });
    onComplete();
  }

  function show() {
    if (!active) opener = document.activeElement;
    cancelTimer();
    presentation += 1;
    active = true;
    paused = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    document.addEventListener('visibilitychange', visibilityChanged);
    goTo(0);
    if (!dialog.open) dialog.showModal();
    next.focus({ preventScroll: true });
  }

  skip.addEventListener('click', finish);
  next.addEventListener('click', advance);
  previous.addEventListener('click', () => goTo(page - 1));
  pause.addEventListener('click', () => {
    if (!active) return;
    paused = !paused;
    if (paused) cancelTimer(true);
    updatePlayback();
  });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); });
  dialog.addEventListener('close', () => { if (!dialog.open) finish(); });
  dialog.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if (event.key === 'ArrowRight') advance();
      else goTo(page - 1);
    }
  });
  dialog.addEventListener('keyup', (event) => event.stopPropagation());

  return { show, hide, isOpen: () => active && dialog.open };
}
