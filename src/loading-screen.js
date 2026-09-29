const activeScreens = new WeakMap();

export function dismissLoadingScreen() {
  const root = document.querySelector('#boot-loader');
  if (root) activeScreens.get(root)?.dismiss();
}

/** The same tiny screen can bridge a slow first visit and a rushed story skip. */
export function createLoadingScreen() {
  const root = document.querySelector('#boot-loader');
  const bar = document.querySelector('#boot-progress');
  const number = document.querySelector('#boot-percent');
  const fill = document.querySelector('#boot-fill');
  const caption = document.querySelector('#boot-caption');
  const status = document.querySelector('#boot-status');
  const retry = document.querySelector('#boot-retry');
  const app = document.querySelector('#app');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 1, target = 1, frame = null, previousTime = null;
  let stopped = false, completion = null, finishProgress = null;
  const owner = { cancel, dismiss };
  const isCurrent = () => activeScreens.get(root) === owner;

  function cancel() {
    stopped = true;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    finishProgress?.();
  }

  function dismiss() {
    cancel();
    if (!isCurrent()) return;
    root.hidden = true;
    app.inert = false;
    app.removeAttribute('aria-hidden');
    activeScreens.delete(root);
  }

  function paint(value) {
    number.textContent = `${value}%`;
    bar.setAttribute('aria-valuenow', String(value));
    fill.style.transform = `scaleX(${value / 100})`;
    caption.textContent = value < 35 ? '把一点点美好，悄悄装进行囊。'
      : value < 85 ? '有些熟悉的风景，藏着还没说的小秘密。'
      : value < 100 ? '再等一小会儿，就要见面啦。' : '准备好了。把下一站，交给好奇心。';
  }

  function tick(time) {
    frame = null;
    if (stopped || !isCurrent()) return;
    const elapsed = previousTime === null ? 16 : Math.min(64, time - previousTime);
    previousTime = time;
    // Smooth only toward verified progress; waiting cannot advance the number.
    current = Math.min(target, current + Math.max(1, Math.round(elapsed / 9)));
    paint(current);
    if (current < target) frame = requestAnimationFrame(tick);
    else { previousTime = null; if (current === 100) finishProgress?.(); }
  }

  function update(value) {
    if (stopped || !isCurrent()) return;
    target = Math.max(target, Math.min(100, Math.max(1, Math.floor(value))));
    if (reduced) { current = target; paint(current); if (current === 100) finishProgress?.(); }
    else if (frame === null && current < target) frame = requestAnimationFrame(tick);
  }

  function show(message) {
    activeScreens.get(root)?.cancel();
    activeScreens.set(root, owner);
    current = target = 1;
    previousTime = null;
    completion = finishProgress = null;
    root.hidden = false;
    root.classList.remove('is-leaving', 'is-error');
    app.inert = true;
    app.setAttribute('aria-hidden', 'true');
    retry.hidden = true;
    stopped = false;
    paint(1);
    if (message) caption.textContent = message;
    status.textContent = '正在准备旅程。';
  }

  function finish() {
    if (!isCurrent() || stopped) return Promise.resolve();
    if (completion) return completion;
    completion = (async () => {
      await new Promise(resolve => { finishProgress = resolve; update(100); if (current === 100) resolve(); });
      if (!isCurrent() || stopped) return;
      status.textContent = '旅程已经准备好。';
      await new Promise(resolve => setTimeout(resolve, reduced ? 0 : 180));
      if (!isCurrent() || stopped) return;
      root.classList.add('is-leaving');
      await new Promise(resolve => setTimeout(resolve, reduced ? 0 : 220));
      if (!isCurrent() || stopped) return;
      root.hidden = true;
      app.inert = false;
      app.removeAttribute('aria-hidden');
      stopped = true;
      if (frame !== null) cancelAnimationFrame(frame);
      finishProgress = null;
    })();
    return completion;
  }

  function error() {
    if (!isCurrent()) return;
    stopped = true;
    if (frame !== null) cancelAnimationFrame(frame);
    root.classList.add('is-error');
    caption.textContent = '小列车在途中歇了歇。再试一次，惊喜还在等你。';
    status.textContent = '暂时没能准备好旅程，请检查网络后重试。';
    retry.hidden = false;
    retry.onclick = () => location.reload();
    retry.focus({ preventScroll: true });
  }

  return { show, update, finish, error };
}
