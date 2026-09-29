import { PHOTO_CATEGORIES } from './photos.js';
import { PHOTO_THUMBNAILS } from './photo-thumbnails.js';
import { getBuildingPhotoIds, getUnlockedPhotos } from './photo-access.js';
import { MEMORY_TILES } from './exploration.js';
import './photo-album.css';

let albumCount = 0;
const asset = (src) => `${import.meta.env?.BASE_URL ?? '/'}assets/${src}`;
const SHORT_LABELS = {
  campus: '校园', portraits: '合照', dining: '吃饭',
  journeys: '旅途', exhibitions: '展览', objects: '小物',
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, label, control) {
  const node = element('button', className, label);
  node.type = 'button';
  node.dataset.albumControl = control;
  return node;
}

export function createPhotoAlbum({ getState = () => null, onOpen, onPhotoChange, onPreview, mount = null } = {}) {
  const embedded = Boolean(mount);
  const titleId = `photo-album-title-${++albumCount}`;
  const dialog = element(embedded ? 'section' : 'dialog', `photo-album${embedded ? ' photo-album--embedded' : ''}`);
  dialog.setAttribute('aria-labelledby', titleId);
  if (embedded) dialog.hidden = true;
  const page = element('div', 'photo-album__page');
  const header = element('header', 'photo-album__header');
  const heading = element('div', 'photo-album__heading');
  heading.append(element('p', 'photo-album__eyebrow', '沿途收集 · 共同回忆'));
  const title = element('h2', 'photo-album__title', '我们的相册');
  title.id = titleId;
  const intro = element('p', 'photo-album__intro', '走到的地方，照片也慢慢收进来。');
  heading.append(title, intro);
  const closeButton = button('photo-album__close', '×', 'close');
  closeButton.setAttribute('aria-label', '关闭相册');
  closeButton.autofocus = true;
  header.append(heading);
  if (!embedded) header.append(closeButton);

  const toolbar = element('div', 'photo-album__toolbar');
  const filters = element('nav', 'photo-album__filters');
  filters.setAttribute('aria-label', '按内容查看照片');
  const allPhotosButton = button('photo-album__show-all', '全部已收集照片 ↗', 'show-all');
  toolbar.append(filters, allPhotosButton);

  const layout = element('div', 'photo-album__layout');
  const main = element('section', 'photo-album__main');
  main.setAttribute('aria-label', '当前照片');
  const figure = element('figure', 'photo-album__figure');
  const frame = element('div', 'photo-album__frame');
  const photo = element('img', 'photo-album__image');
  photo.decoding = 'async';
  photo.draggable = false;
  const imageError = element('p', 'photo-album__image-error', '这张照片暂时没打开，可以先翻下一张。');
  imageError.hidden = true;
  frame.append(photo, imageError);
  const caption = element(embedded ? 'div' : 'figcaption', 'photo-album__caption');
  const photoTitle = element('h3', 'photo-album__photo-title');
  const photoDate = element('p', 'photo-album__photo-date');
  const photoCaption = element('p', 'photo-album__photo-caption');
  caption.append(photoDate, photoTitle, photoCaption);
  figure.append(frame);
  if (!embedded) figure.append(caption);

  const navigation = element('div', 'photo-album__navigation');
  const previous = button('photo-album__arrow', '←', 'previous');
  previous.setAttribute('aria-label', '上一张照片');
  const position = element('p', 'photo-album__position');
  position.setAttribute('role', 'status');
  position.setAttribute('aria-live', 'polite');
  position.setAttribute('aria-atomic', 'true');
  const next = button('photo-album__arrow', '→', 'next');
  next.setAttribute('aria-label', '下一张照片');
  navigation.append(previous, position, next);
  const empty = element('p', 'photo-album__empty', '这一页还空着。开车去更多地方，照片会慢慢收进来。');
  main.append(figure);
  if (!embedded) main.append(navigation);
  main.append(empty);

  const sidebar = element('aside', 'photo-album__sidebar');
  sidebar.setAttribute('aria-label', '照片目录');
  const count = element('p', 'photo-album__count');
  const thumbnails = element('div', 'photo-album__thumbnails');
  heading.append(count);
  if (embedded) sidebar.append(caption, navigation);
  sidebar.append(thumbnails);
  layout.append(main, sidebar);
  page.append(header, toolbar, layout);
  dialog.append(page);
  (mount ?? document.body).append(dialog);

  let category = 'all';
  let requestedIds = null;
  let requestedBuilding = null;
  let currentId = null;
  let opener = null;
  let backdropPointerDown = false;
  const isOpen = () => embedded ? !dialog.hidden : dialog.open;

  function previewCurrent(trigger = frame) {
    const current = visiblePhotos().find(item => item.id === currentId);
    if (!onPreview || !isOpen() || !current || photo.hidden || imageError.hidden === false
      || photo.getAttribute('src') !== asset(current.src)) return;
    onPreview(photo, {label:current.title,trigger});
  }
  if (onPreview) {
    frame.classList.add('image-preview-trigger');
    frame.setAttribute('role', 'button');
    frame.setAttribute('tabindex', '-1');
    frame.title = '点击放大，再次点击图片退出';
    frame.addEventListener('click', () => previewCurrent());
    frame.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); event.stopPropagation(); previewCurrent();
    });
  }

  // This is the only route from the catalog into any rendered text or image src.
  // Filtering happens before IDs, categories, counts, previews, and thumbnails.
  function availablePhotos() {
    try { return getUnlockedPhotos(getState()); } catch { return []; }
  }

  function scopedPhotos() {
    const available = availablePhotos();
    const buildingIds = requestedBuilding === null ? null : new Set(getBuildingPhotoIds(requestedBuilding));
    return available.filter(item => (!requestedIds || requestedIds.has(item.id))
      && (!buildingIds || buildingIds.has(item.id)));
  }

  function visiblePhotos(scope = scopedPhotos()) {
    if (category !== 'all' && !scope.some((item) => item.category === category)) category = 'all';
    return category === 'all' ? scope : scope.filter((item) => item.category === category);
  }

  function restoreControlFocus(control) {
    if (!isOpen() || !control) return;
    const replacement = [...dialog.querySelectorAll('[data-album-control]')]
      .find((node) => node.dataset.albumControl === control && !node.disabled && !node.hidden);
    const fallback = (control === 'next' && !previous.disabled) ? previous
      : (control === 'previous' && !next.disabled) ? next
        : filters.querySelector('[aria-pressed="true"]') ?? (embedded ? previous : closeButton);
    (replacement ?? fallback).focus({ preventScroll: true });
  }

  function render() {
    const focusedControl = dialog.contains(document.activeElement)
      ? document.activeElement.dataset.albumControl : null;
    const filterScroll = filters.scrollLeft;
    const thumbnailScroll = { left: thumbnails.scrollLeft, top: thumbnails.scrollTop };
    const scope = scopedPhotos();
    const visible = visiblePhotos(scope);
    if (!visible.some((item) => item.id === currentId)) currentId = visible[0]?.id ?? null;
    const currentIndex = visible.findIndex((item) => item.id === currentId);
    const current = visible[currentIndex];

    filters.replaceChildren();
    const filterData = [{ id: 'all', label: '全部' }, ...PHOTO_CATEGORIES];
    for (const item of filterData) {
      const total = item.id === 'all' ? scope.length : scope.filter((image) => image.category === item.id).length;
      if (item.id !== 'all' && total === 0) continue;
      const label = SHORT_LABELS[item.id] ?? item.label;
      const filter = button('photo-album__filter', label, `filter-${item.id}`);
      const amount = element('span', 'photo-album__filter-count', String(total));
      amount.setAttribute('aria-hidden', 'true');
      filter.append(amount);
      filter.setAttribute('aria-label', `${label}，${total} 张照片`);
      filter.setAttribute('aria-pressed', String(item.id === category));
      filter.addEventListener('click', () => {
        if (category === item.id) return;
        changePhoto(() => {
          category = item.id;
          currentId = null;
        });
      });
      filters.append(filter);
    }
    allPhotosButton.hidden = requestedIds === null && requestedBuilding === null;
    const building = MEMORY_TILES.find(item => item.id === requestedBuilding);
    title.textContent = building ? `${building.title} · 相册` : '我们的相册';
    intro.textContent = building ? '在这里收下的照片，慢慢翻。' : '走到的地方，照片也慢慢收进来。';
    count.textContent = `${visible.length} 张照片`;
    thumbnails.replaceChildren();

    for (const [index, item] of visible.entries()) {
      const thumb = button('photo-album__thumbnail', undefined, `thumb-${item.id}`);
      thumb.setAttribute('aria-label', `查看第 ${index + 1} 张：${item.title}`);
      if (item.id === currentId) thumb.setAttribute('aria-current', 'true');
      const thumbnail = element('img', 'photo-album__thumbnail-image');
      const smallSrc = PHOTO_THUMBNAILS[item.src];
      if (smallSrc) {
        let usedFallback = false;
        thumbnail.addEventListener('error', () => {
          if (usedFallback || !thumbnail.isConnected || !isOpen()
            || !visiblePhotos().some(photo => photo.id === item.id && photo.src === item.src)) return;
          usedFallback = true;
          thumbnail.src = asset(item.src);
        });
      }
      thumbnail.src = asset(smallSrc ?? item.src);
      thumbnail.alt = '';
      thumbnail.loading = 'lazy';
      thumbnail.decoding = 'async';
      thumbnail.draggable = false;
      thumb.append(thumbnail, element('span', 'photo-album__thumbnail-number', String(index + 1).padStart(2, '0')));
      thumb.addEventListener('click', () => {
        changePhoto(() => { currentId = item.id; });
        if (onPreview) previewCurrent(thumbnails.querySelector('[aria-current="true"]') ?? frame);
      });
      thumbnails.append(thumb);
    }

    figure.hidden = !current;
    caption.hidden = !current;
    navigation.hidden = !current;
    empty.hidden = Boolean(current);
    if (current) {
      const nextSrc = asset(current.src);
      if (photo.getAttribute('src') !== nextSrc) {
        imageError.hidden = true;
        photo.hidden = false;
        photo.src = nextSrc;
      }
      photo.alt = current.title;
      if (onPreview) {
        frame.setAttribute('aria-label', `放大照片：${current.title}`);
        frame.setAttribute('tabindex', photo.hidden ? '-1' : '0');
      }
      photoTitle.textContent = current.title;
      photoDate.textContent = current.dateLabel ?? '';
      photoDate.hidden = !current.dateLabel;
      photoCaption.textContent = current.caption;
      position.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(visible.length).padStart(2, '0')}`;
    } else {
      photo.removeAttribute('src');
      photo.alt = '';
      if (onPreview) { frame.setAttribute('tabindex', '-1'); frame.removeAttribute('aria-label'); }
      photoTitle.textContent = '';
      photoDate.textContent = '';
      photoDate.hidden = true;
      photoCaption.textContent = '';
      position.textContent = '';
    }
    previous.disabled = currentIndex <= 0;
    next.disabled = currentIndex < 0 || currentIndex >= visible.length - 1;
    filters.scrollLeft = filterScroll;
    thumbnails.scrollLeft = thumbnailScroll.left;
    thumbnails.scrollTop = thumbnailScroll.top;
    restoreControlFocus(focusedControl);
  }

  function changePhoto(update) {
    if (!isOpen()) return;
    const previousId = currentId;
    update();
    render();
    if (currentId !== null && currentId !== previousId) onPhotoChange?.();
  }

  function step(direction) {
    const visible = visiblePhotos();
    const index = visible.findIndex((item) => item.id === currentId);
    if (index < 0) {
      render();
      return;
    }
    const target = visible[index + direction];
    if (!target) { render(); return; }
    changePhoto(() => { currentId = target.id; });
    // Scroll only the contact sheet; the collection header stays in place.
    const thumb = thumbnails.querySelector('[aria-current="true"]');
    if (thumb) {
      for (const [scroll, offset, size, viewport] of [
        ['scrollTop', 'offsetTop', 'offsetHeight', 'clientHeight'],
        ['scrollLeft', 'offsetLeft', 'offsetWidth', 'clientWidth'],
      ]) {
        if (thumb[offset] < thumbnails[scroll]) thumbnails[scroll] = thumb[offset];
        else if (thumb[offset] + thumb[size] > thumbnails[scroll] + thumbnails[viewport]) {
          thumbnails[scroll] = thumb[offset] + thumb[size] - thumbnails[viewport];
        }
      }
    }
  }

  function close() {
    if (embedded) {
      dialog.hidden = true;
      clearPhotos();
    } else if (dialog.open) dialog.close();
  }

  function open(options = {}) {
    const { category: nextCategory = 'all', ids, buildingId } = options ?? {};
    if (!isOpen() && !embedded) opener = document.activeElement;
    requestedIds = Array.isArray(ids) ? new Set(ids.filter((id) => typeof id === 'string')) : null;
    requestedBuilding = buildingId == null ? null : typeof buildingId === 'string' ? buildingId : '';
    category = PHOTO_CATEGORIES.some((item) => item.id === nextCategory) ? nextCategory : 'all';
    currentId = null;
    render();
    const isOpening = !isOpen();
    if (embedded) dialog.hidden = false;
    else {
      if (isOpening) dialog.showModal();
      closeButton.focus({ preventScroll: true });
    }
    if (isOpening && isOpen()) onOpen?.();
  }

  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  closeButton.addEventListener('click', close);
  allPhotosButton.addEventListener('click', () => {
    changePhoto(() => {
      requestedIds = null;
      requestedBuilding = null;
      category = 'all';
      currentId = null;
    });
  });
  photo.addEventListener('error', () => {
    photo.hidden = true;
    imageError.hidden = false;
    if (onPreview) frame.setAttribute('tabindex', '-1');
  });
  photo.addEventListener('load', () => {
    photo.hidden = false;
    imageError.hidden = true;
    if (onPreview && currentId) frame.setAttribute('tabindex', '0');
  });
  // Keep game shortcuts outside the collection; native Escape closes its dialog.
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('keyup', (event) => event.stopPropagation());
  function clearPhotos() {
    // Clear images when closed so a later reset cannot leave an unlocked photo in the DOM.
    photo.removeAttribute('src');
    photo.alt = '';
    if (onPreview) { frame.setAttribute('tabindex', '-1'); frame.removeAttribute('aria-label'); }
    thumbnails.replaceChildren();
    filters.replaceChildren();
    photoTitle.textContent = '';
    photoDate.textContent = '';
    photoCaption.textContent = '';
    count.textContent = '';
    position.textContent = '';
  }
  if (!embedded) {
    dialog.addEventListener('pointerdown', (event) => {
      backdropPointerDown = event.target === dialog;
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && backdropPointerDown) close();
      backdropPointerDown = false;
    });
    dialog.addEventListener('close', () => {
      // A queued close event from an earlier opening must not clear a newly opened album.
      if (dialog.open) return;
      const target = opener;
      opener = null;
      clearPhotos();
      window.requestAnimationFrame(() => {
        if (!dialog.open && target?.isConnected && typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      });
    });
  }

  return { open, close, refresh: () => { if (isOpen()) render(); } };
}
