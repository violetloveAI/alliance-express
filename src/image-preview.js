let instanceCount = 0;

function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function cloneArtwork(source, prefix) {
  const clone = source.cloneNode(true);
  const elements = [clone, ...clone.querySelectorAll('*')];
  const ids = new Map();
  clone.removeAttribute('id');
  clone.removeAttribute('style');
  for (const element of elements.slice(1)) {
    const id = element.getAttribute('id');
    if (id) {
      const uniqueId = `${prefix}-${ids.size}`;
      ids.set(id, uniqueId);
      element.setAttribute('id', uniqueId);
    }
  }
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    for (const { name, value } of [...element.attributes]) {
      if (/^on/i.test(name) || ['tabindex', 'autofocus', 'contenteditable'].includes(name)) {
        element.removeAttribute(name);
        continue;
      }
      let updated = value.replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g,
        (reference, quote, id) => ids.has(id) ? `url(${quote}#${ids.get(id)}${quote})` : reference);
      if (['href', 'xlink:href'].includes(name) && value.startsWith('#') && ids.has(value.slice(1))) updated = `#${ids.get(value.slice(1))}`;
      if (['aria-labelledby', 'aria-describedby'].includes(name)) updated = value.split(/\s+/).map((id) => ids.get(id) ?? id).join(' ');
      if (updated !== value) element.setAttribute(name, updated);
    }
    if (/^(button|link|checkbox|radio|switch|tab|menuitem|slider|spinbutton|textbox|combobox)$/.test(element.getAttribute('role') ?? '')) element.removeAttribute('role');
    if (tag === 'a' || tag === 'area') { element.removeAttribute('href'); element.removeAttribute('xlink:href'); }
    if (['button', 'input', 'select', 'textarea'].includes(tag)) element.disabled = true;
    if (tag === 'img') {
      element.removeAttribute('style');
      element.removeAttribute('width');
      element.removeAttribute('height');
      element.loading = 'eager';
      element.decoding = 'async';
      element.draggable = false;
    }
  }
  clone.className = `${clone.className} ${source.tagName.toLowerCase() === 'img' ? 'image-preview__image' : 'image-preview__gallery'}`.trim();
  return clone;
}

export function createImagePreview() {
  const id = `image-preview-${++instanceCount}`;
  const dialog = node('dialog', 'image-preview');
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  dialog.setAttribute('aria-describedby', `${id}-hint`);
  dialog.setAttribute('aria-modal', 'true');
  const header = node('header', 'image-preview__header');
  const title = node('h2', 'image-preview__title');
  title.id = `${id}-title`;
  const dismiss = node('button', 'image-preview__close', '×');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', '关闭图片预览，返回回忆');
  header.append(title, dismiss);
  const surface = node('div', 'image-preview__surface');
  const hint = node('p', 'image-preview__hint', '再点一下图片，回到回忆里');
  hint.id = `${id}-hint`;
  dialog.append(header, surface, hint);
  document.body.append(dialog);

  let active = false;
  let opener = null;
  let presentation = 0;

  function clearContent() {
    for (const image of surface.querySelectorAll('img')) {
      image.removeAttribute('src');
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
    }
    for (const image of surface.querySelectorAll('image')) {
      image.removeAttribute('href');
      image.removeAttribute('xlink:href');
    }
    surface.replaceChildren();
    title.textContent = '';
  }

  function close({ restoreFocus = true } = {}) {
    if (!active && !dialog.open) return;
    const target = opener;
    opener = null;
    active = false;
    const closedPresentation = ++presentation;
    clearContent();
    if (dialog.open) dialog.close();
    if (restoreFocus) window.requestAnimationFrame(() => {
      if (presentation === closedPresentation && !dialog.open && target?.isConnected
        && typeof target.focus === 'function') target.focus({ preventScroll: true });
    });
  }

  function open(source, { label, trigger } = {}) {
    if (source?.tagName?.toLowerCase() !== 'img' && !source?.classList?.contains('hero-gallery')) return;
    const clone = cloneArtwork(source, `${id}-art-${++presentation}`);
    opener = trigger ?? (active ? opener : document.activeElement);
    clearContent();
    title.textContent = label || source.alt || source.getAttribute('aria-label') || '完整图片';
    surface.append(clone);
    active = true;
    if (!dialog.open) dialog.showModal();
    dismiss.focus({ preventScroll: true });
  }

  dismiss.addEventListener('click', (event) => { event.stopPropagation(); close(); });
  surface.addEventListener('click', (event) => { event.stopPropagation(); close(); });
  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target === dialog) close();
  });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    // A queued close event from the previous showing must not clear a new one.
    if (!dialog.open) close();
  });
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('keyup', (event) => event.stopPropagation());

  return { open, close, isOpen: () => active && dialog.open };
}
