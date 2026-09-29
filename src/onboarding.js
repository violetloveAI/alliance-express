import './onboarding.css';
import { createPrologue } from './prologue.js';

const asset = (name) => `${import.meta.env?.BASE_URL ?? '/'}assets/${name}`;
const noop = () => {};
let instanceCount = 0;

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function actionButton(action, label, secondary = false) {
  const button = node('button', secondary ? 'onboarding__secondary' : 'onboarding__primary', label);
  button.type = 'button';
  button.dataset.onboardingAction = action;
  if (!secondary) {
    const arrow = node('span', 'onboarding__button-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12c4-.5 9-.5 14 0m-6-5 6 5-6 5"/></svg>';
    button.append(arrow);
  }
  return button;
}

function artwork(file, className, alt) {
  const image = node('img', className);
  image.src = asset(file);
  image.alt = alt;
  image.decoding = 'async';
  image.draggable = false;
  return image;
}

const INSTRUCTIONS = [
  {
    title: '点一格，开过去',
    text: '点相邻的发亮格，小车就出发。一格算一步。',
    art: '<path d="m8 33 22-12 22 12v25L30 70 8 58Z" fill="#dae3be"/><path d="m50 33 23-12 23 12v25L73 70 50 58Z" fill="#f5d999" stroke="#bc985b" stroke-dasharray="3 4"/><path d="M30 16C41 2 65 4 78 14m-2-8 3 9-10-1" fill="none" stroke="#a37d50"/><path d="M16 36h21l5 8v11H16Z" fill="#839868"/><path d="M20 29h12v14H20Z" fill="#aec495"/><path d="M24 31h5v8h-5Z" fill="#fff8e7"/><circle cx="22" cy="56" r="4" fill="#756343"/><circle cx="36" cy="56" r="4" fill="#756343"/><path d="m105 33 3-6m-3 15 7-1" stroke="#d3ac5e"/>',
  },
  {
    title: '走近风景，遇见回忆',
    text: '雾里藏着老地方。走到那里，读一段小回忆。',
    art: '<path d="M8 65c22-13 65-11 105 0" fill="#dce5c1" stroke="none"/><path d="M40 33h36v28H40Z" fill="#f5e7c5"/><path d="m33 34 26-20 25 20Z" fill="#c98c72"/><path d="M54 44h12v17H54Z" fill="#b1be8e"/><path d="M44 39h7v8h-7m18-8h7v8h-7" fill="#fff9ea" stroke="#c7ad7a"/><path d="M13 52c-7-8 1-18 10-14 0-12 19-14 22-3" fill="#fffaf0" stroke="#d9d4bf" stroke-dasharray="2 4"/><path d="M83 53c0-10 17-9 18-2 10-2 15 10 8 14" fill="#fffaf0" stroke="#d9d4bf" stroke-dasharray="2 4"/><path d="M97 19c-7-8-15 2-8 8l8 7 8-7c7-6-1-16-8-8Z" fill="#dc9d8b" stroke="none"/><path d="M22 62v-9m-4 3 4-3 5 4" stroke="#95ab74"/>',
  },
  {
    title: '拖一拖，看看远处',
    text: '拖动地图，也能放大缩小。四处看看不计步。',
    art: '<path d="m14 23 27-7 25 7 27-7v45l-27 7-25-7-27 7Z" fill="#e7edcf"/><path d="M41 16v45m25-38v45" stroke="#b9c699"/><path d="M25 52c13-22 29 8 43-14" fill="none" stroke="#c7a77b" stroke-dasharray="4 4"/><circle cx="78" cy="34" r="17" fill="#fff7e7" stroke="#839675" stroke-width="3"/><path d="m91 48 13 15" stroke="#9c835b" stroke-width="7"/><path d="M70 34h16m-8-8v16" stroke="#839675" stroke-width="2"/><path d="M12 13h21m-4-4 4 4-4 4m-17-4 4-4m-4 4 4 4" fill="none" stroke="#b89a68"/>',
  },
];

export function createOnboarding({
  onStart = noop,
  onTutorialComplete = noop,
} = {}) {
  const dialog = node('dialog', 'onboarding');
  const titleId = `onboarding-title-${++instanceCount}`;
  dialog.setAttribute('aria-labelledby', titleId);
  document.body.append(dialog);

  let mode = null;
  let presentation = 0;
  let opener = null;
  let actionPending = false;
  let backdropDown = false;
  let prologue = null;

  function hide({ restoreFocus = true } = {}) {
    prologue?.hide({ restoreFocus });
    const target = opener;
    opener = null;
    mode = null;
    actionPending = false;
    const closedPresentation = ++presentation;
    if (dialog.open) dialog.close();
    if (restoreFocus) window.requestAnimationFrame(() => {
      if (presentation === closedPresentation && !dialog.open && target?.isConnected
        && typeof target.focus === 'function') target.focus({ preventScroll: true });
    });
  }

  function begin(nextMode) {
    prologue?.hide({ restoreFocus: false });
    if (!dialog.open) opener = document.activeElement;
    mode = nextMode;
    actionPending = false;
    backdropDown = false;
    presentation += 1;
    dialog.dataset.onboardingMode = nextMode;
    dialog.replaceChildren();
    return presentation;
  }

  function reveal(focusTarget) {
    if (!dialog.open) dialog.showModal();
    focusTarget.focus({ preventScroll: true });
  }

  function finishTutorial(expectedPresentation = presentation) {
    if (mode !== 'tutorial' || presentation !== expectedPresentation || actionPending) return;
    actionPending = true;
    hide();
    onTutorialComplete();
  }

  function startAction(expectedPresentation) {
    if (mode !== 'start' || presentation !== expectedPresentation || actionPending) return;
    actionPending = true;
    hide();
    onStart();
  }

  function showStart() {
    const current = begin('start');
    const cover = node('div', 'onboarding__cover');
    const copy = node('section', 'onboarding__cover-copy');
    const edition = node('p', 'onboarding__edition', '一张地图 · 两位老队友');
    const date = node('time', 'onboarding__date', '2026年10月');
    date.setAttribute('datetime', '2026-10');
    copy.append(edition, date);
    const wordmark = node('div', 'onboarding__wordmark');
    const title = node('h1', 'onboarding__cover-title');
    title.id = titleId;
    title.setAttribute('aria-label', '同盟漫游记');
    for (const letter of '同盟漫游记') {
      const paintedLetter = node('span', 'onboarding__painted-letter', letter);
      paintedLetter.setAttribute('aria-hidden', 'true');
      title.append(paintedLetter);
    }
    const sprig = node('span', 'onboarding__title-sprig');
    sprig.setAttribute('aria-hidden', 'true');
    sprig.innerHTML = '<svg viewBox="0 0 36 48" fill="none"><path d="M12 43c4-12 8-23 13-35" stroke="#85986a" stroke-width="2" stroke-linecap="round"/><path d="M19 26C5 26 5 13 10 15s8 6 9 11M22 20C23 8 35 7 32 13s-6 7-10 7M15 36C2 34 2 24 7 27s6 5 8 9" fill="#a7b98a"/></svg>';
    const flower = node('span', 'onboarding__title-flower');
    flower.setAttribute('aria-hidden', 'true');
    flower.innerHTML = '<svg viewBox="0 0 40 40"><path d="M20 15C9-1 3 15 14 20-2 29 16 36 20 26c8 16 20 0 7-6 14-8-1-21-7-5Z" fill="#e1b869"/><circle cx="20" cy="20" r="4" fill="#a98351"/></svg>';
    wordmark.append(title, sprig, flower);
    copy.append(wordmark, node('p', 'onboarding__names', 'Water Sheep × Violet'));
    copy.append(node('p', 'onboarding__invitation', '老队友，今天随便走走。'));
    copy.append(node('p', 'onboarding__cover-note', '一起吃过的饭，走过的路，\n都藏进这座小岛，等我们再遇见。'));
    const actions = node('div', 'onboarding__cover-actions');
    const primary = actionButton('start', '出发');
    primary.addEventListener('click', () => startAction(current));
    actions.append(primary);
    const coverArt = node('figure', 'onboarding__cover-art');
    const image = artwork('cover-watercolor-v4.webp', 'onboarding__cover-image', '水彩花园里，Water Sheep 开着绿色小列车，Violet 从车窗探出头，远处是熟悉的校园');
    image.fetchPriority = 'high';
    image.addEventListener('error', () => { image.hidden = true; });
    coverArt.append(image, node('figcaption', 'onboarding__art-note', '回忆不赶路，我们慢慢来。'));
    const footer = node('footer', 'onboarding__cover-footer');
    footer.append(node('span', '', '手机、电脑都能慢慢逛'), node('span', '', '每次见面，都是一次新的漫游。'));
    cover.append(copy, coverArt, actions, footer);
    dialog.append(cover);
    reveal(primary);
  }

  function showPrologue() {
    hide({ restoreFocus: false });
    mode = 'prologue';
    prologue ??= createPrologue({ onComplete: () => {
      if (mode === 'prologue') showTutorial();
    } });
    prologue.show();
  }

  function showTutorial() {
    const current = begin('tutorial');
    const page = node('div', 'onboarding__tutorial');
    const intro = node('header', 'onboarding__tutorial-intro');
    const scene = node('div', 'onboarding__school-scene');
    scene.append(artwork('cover-watercolor-v4.webp', 'onboarding__school', '校园前，Water Sheep 和 Violet 的小列车准备出发'));
    const words = node('div', 'onboarding__welcome');
    words.append(node('p', 'onboarding__speaker', 'Violet · 出发前的小纸条'));
    const title = node('h2', 'onboarding__tutorial-title', '第一站，到了。');
    title.id = titleId;
    words.append(title, node('p', 'onboarding__dialogue', '好多顿饭、好多段路，都藏在小岛里。\n不用赶路，往你想去的地方开。'));
    intro.append(scene, words);

    const instructions = node('ol', 'onboarding__instructions');
    for (const instruction of INSTRUCTIONS) {
      const item = node('li', 'onboarding__instruction');
      const symbol = node('span', 'onboarding__instruction-icon');
      symbol.setAttribute('aria-hidden', 'true');
      symbol.innerHTML = `<svg viewBox="0 0 124 80" fill="none" stroke="#a7a586" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${instruction.art}</svg>`;
      const text = node('div', 'onboarding__instruction-copy');
      text.append(node('h3', '', instruction.title), node('p', '', instruction.text));
      item.append(symbol, text);
      instructions.append(item);
    }
    const actions = node('footer', 'onboarding__tutorial-actions');
    const skip = actionButton('skip', '跳过介绍', true);
    const complete = actionButton('complete', '开始漫游');
    skip.addEventListener('click', () => finishTutorial(current));
    complete.addEventListener('click', () => finishTutorial(current));
    actions.append(skip, complete);
    page.append(intro, instructions, actions);
    dialog.append(page);
    reveal(complete);
  }

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (mode === 'tutorial') finishTutorial();
  });
  dialog.addEventListener('pointerdown', (event) => { backdropDown = event.target === dialog; });
  dialog.addEventListener('click', (event) => {
    if (mode === 'tutorial' && backdropDown && event.target === dialog) finishTutorial();
    backdropDown = false;
  });
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('keyup', (event) => event.stopPropagation());
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    if (mode === 'tutorial') finishTutorial();
    else if (mode === 'start') dialog.showModal();
  });

  return { showStart, showPrologue, showTutorial, hide, isOpen: () => dialog.open || Boolean(prologue?.isOpen()) };
}
