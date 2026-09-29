/** Progress counts completed startup work, never elapsed time or guessed bytes. */
export async function prepareStartup({ loadApp, loadCover, loadFonts, onProgress = () => {} }) {
  let progress = 1;
  let failed = false;
  onProgress(progress);
  const complete = weight => {
    if (failed) return;
    progress += weight;
    onProgress(progress);
  };
  const app = Promise.resolve().then(loadApp).then(value => { complete(18); return value; });
  const cover = Promise.resolve().then(loadCover).then(value => { complete(65); return value; });
  const fonts = app.then(() => Promise.resolve().then(loadFonts).catch(() => undefined))
    .then(() => complete(16));
  try {
    const [application, image] = await Promise.all([app, cover, fonts]);
    return { app: application, cover: image };
  } catch (error) {
    failed = true;
    throw error;
  }
}

export function withTimeout(promise, milliseconds, message = '准备时间有点久') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    Promise.resolve(promise).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

export function loadCoverImage(url, timeout = 15000) {
  return withTimeout(new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.onload = async () => {
      try {
        await image.decode();
        image.onload = image.onerror = null;
        resolve(image);
      } catch (error) { reject(error); }
    };
    image.onerror = () => { image.onload = image.onerror = null; reject(new Error('封面还没到站')); };
    image.src = url;
  }), timeout, '封面还在路上，请再试一次');
}
