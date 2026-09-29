import './tooltips.css';

const HOLD_DELAY = 450;
const HOLD_READING_TIME = 2400;
const MOVE_TOLERANCE = 10;
let tooltipCount = 0;

/** Add a shared, accessible tooltip to the controls matched by each config. */
export function installTooltips(root = document, configs = []) {
  const doc = root.ownerDocument ?? root;
  const view = doc.defaultView ?? window;
  const tooltip = doc.createElement('div');
  tooltip.id = `journey-tooltip-${++tooltipCount}`;
  tooltip.className = 'journey-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('popover', 'manual');
  tooltip.hidden = true;
  const title = doc.createElement('strong');
  title.className = 'journey-tooltip__title';
  const description = doc.createElement('span');
  description.className = 'journey-tooltip__description';
  tooltip.append(title, description);
  doc.body.append(tooltip);

  const records = new Map();
  const cleanups = [];
  let active = null;
  let press = null;
  let dismissTimer = null;
  let lastPointerType = '';
  let disposed = false;

  function listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  function removeDescription(element) {
    const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/)
      .filter(id => id && id !== tooltip.id);
    if (ids.length) element.setAttribute('aria-describedby', ids.join(' '));
    else element.removeAttribute('aria-describedby');
  }

  function hide() {
    clearTimeout(dismissTimer);
    dismissTimer = null;
    if (active) removeDescription(active.element);
    active = null;
    if (typeof tooltip.hidePopover === 'function') {
      // The browser may already have closed the popover with its containing dialog.
      try { tooltip.hidePopover(); } catch { /* Already outside the top layer. */ }
    }
    tooltip.hidden = true;
  }

  function position() {
    if (!active) return;
    if (!active.element.isConnected || active.element.disabled || active.element.hidden) {
      hide();
      return;
    }
    const viewport = view.visualViewport;
    tooltip.style.maxWidth = `${Math.max(1, Math.min(242, (viewport?.width ?? view.innerWidth) - 24))}px`;
    const anchor = active.element.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
    const topEdge = (viewport?.offsetTop ?? 0) + 12;
    const rightEdge = leftEdge + (viewport?.width ?? view.innerWidth) - 24;
    const bottomEdge = topEdge + (viewport?.height ?? view.innerHeight) - 24;
    const above = anchor.top - bounds.height - 10;
    const below = anchor.bottom + 10;
    const placeAbove = above >= topEdge || below + bounds.height > bottomEdge;
    const x = Math.max(leftEdge, Math.min(anchor.left + anchor.width / 2 - bounds.width / 2, rightEdge - bounds.width));
    const y = Math.max(topEdge, Math.min(placeAbove ? above : below, bottomEdge - bounds.height));
    tooltip.style.left = `${Math.round(x)}px`;
    tooltip.style.top = `${Math.round(y)}px`;
    tooltip.dataset.side = placeAbove ? 'above' : 'below';
  }

  function show(record, mode) {
    if (disposed || record.element.disabled || record.element.hidden || !record.element.isConnected) return;
    hide();
    // Keep the description in the modal's accessible subtree, then use the
    // popover top layer to escape its scrolling and clipping containers.
    const host = record.element.closest('dialog[open]') ?? doc.body;
    if (tooltip.parentNode !== host) host.append(tooltip);
    title.textContent = String(typeof record.config.title === 'function' ? record.config.title() : record.config.title ?? '');
    description.textContent = String(typeof record.config.description === 'function'
      ? record.config.description() : record.config.description ?? '');
    description.hidden = !description.textContent;
    active = { ...record, mode };
    const ids = new Set((record.element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    ids.add(tooltip.id);
    record.element.setAttribute('aria-describedby', [...ids].join(' '));
    tooltip.hidden = false;
    if (typeof tooltip.showPopover === 'function') {
      try { tooltip.showPopover(); } catch { /* Fixed positioning also works without the Popover API. */ }
    }
    position();
  }

  function cancelPress({ dismiss = true } = {}) {
    if (!press) return;
    clearTimeout(press.timer);
    const wasShown = press.shown;
    press = null;
    if (wasShown && dismiss) hide();
  }

  function resetSuppression(record) {
    clearTimeout(record.suppressionTimer);
    record.suppressionTimer = null;
    record.suppressClick = false;
  }

  for (const config of configs) {
    const matches = [...root.querySelectorAll(config.selector)];
    if (root.matches?.(config.selector)) matches.unshift(root);
    for (const element of matches) {
      if (records.has(element)) continue;
      const record = { element, config, originalTitle: element.getAttribute('title'), suppressClick: false, suppressionTimer: null };
      records.set(element, record);
      element.removeAttribute('title');
      element.classList.add('has-journey-tooltip');

      listen(element, 'pointerenter', event => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') show(record, 'hover');
      });
      listen(element, 'pointerleave', event => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen' && active?.element === element) hide();
      });
      listen(element, 'focusin', () => {
        if (lastPointerType !== 'touch' && lastPointerType !== 'pen') show(record, 'focus');
      });
      listen(element, 'focusout', () => {
        if (active?.element === element) hide();
      });
      listen(element, 'pointerdown', event => {
        resetSuppression(record);
        cancelPress();
        if (!['touch', 'pen'].includes(event.pointerType) || event.isPrimary === false || event.button > 0 || element.disabled) return;
        hide();
        const gesture = { record, pointerId: event.pointerId, x: event.clientX, y: event.clientY, shown: false, timer: null };
        press = gesture;
        gesture.timer = setTimeout(() => {
          if (press !== gesture) return;
          gesture.shown = true;
          record.suppressClick = true;
          show(record, 'hold');
        }, HOLD_DELAY);
      });
      // Capture runs before existing click handlers on these buttons.
      listen(element, 'click', event => {
        const keyboardClick = event.detail === 0 && !event.pointerType;
        if (record.suppressClick && !keyboardClick) {
          event.preventDefault();
          event.stopImmediatePropagation();
          resetSuppression(record);
          return;
        }
        hide();
      }, true);
      listen(element, 'contextmenu', event => {
        if (press?.record === record || record.suppressClick || (active?.element === element && active.mode === 'hold')) event.preventDefault();
      });
    }
  }

  listen(doc, 'pointerdown', event => {
    lastPointerType = event.pointerType;
    if (press && press.pointerId !== event.pointerId) cancelPress();
    if (active && !active.element.contains(event.target)) hide();
  }, true);
  listen(doc, 'pointermove', event => {
    if (press?.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) cancelPress();
  }, { passive: true });
  listen(doc, 'pointerup', event => {
    if (press?.pointerId !== event.pointerId) return;
    const { record, shown } = press;
    cancelPress({ dismiss: false });
    if (!shown) return;
    record.suppressionTimer = setTimeout(() => resetSuppression(record), 900);
    dismissTimer = setTimeout(hide, HOLD_READING_TIME);
  });
  listen(doc, 'pointercancel', event => {
    if (press?.pointerId === event.pointerId) cancelPress();
  });
  listen(doc, 'keydown', event => {
    lastPointerType = 'keyboard';
    if (event.key !== 'Escape' || (!active && !press)) return;
    // Escape dismisses this explanation before it closes the underlying modal.
    event.preventDefault();
    event.stopPropagation();
    cancelPress();
    hide();
  }, true);
  listen(doc, 'close', hide, true);
  listen(view, 'blur', () => { cancelPress(); hide(); });
  listen(view, 'resize', position);
  listen(doc, 'scroll', position, true);
  if (view.visualViewport) {
    listen(view.visualViewport, 'resize', position);
    listen(view.visualViewport, 'scroll', position);
  }

  const Observer = view.MutationObserver;
  const observer = Observer ? new Observer(changes => {
    for (const change of changes) {
      const record = records.get(change.target);
      if (!record) continue;
      if (change.attributeName === 'title' && record.element.hasAttribute('title')) {
        record.originalTitle = record.element.getAttribute('title');
        record.element.removeAttribute('title');
      }
      if (active?.element === record.element && (record.element.disabled || record.element.hidden)) hide();
    }
  }) : null;
  for (const element of records.keys()) observer?.observe(element, { attributes: true, attributeFilter: ['title', 'disabled', 'hidden'] });

  return function cleanup() {
    if (disposed) return;
    disposed = true;
    cancelPress();
    hide();
    observer?.disconnect();
    for (const remove of cleanups) remove();
    for (const record of records.values()) {
      resetSuppression(record);
      record.element.classList.remove('has-journey-tooltip');
      if (record.originalTitle !== null) record.element.setAttribute('title', record.originalTitle);
    }
    tooltip.remove();
  };
}
