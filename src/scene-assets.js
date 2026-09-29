// One queue per persistent scene: duplicate props share a request, and decoding
// occupies a slot too, so opening the full island cannot decode every image at once.
export class SceneAssetQueue {
  constructor() {
    this.pending = [];
    this.requests = new Map();
    this.active = 0;
  }

  load(url) {
    if (this.requests.has(url)) return this.requests.get(url);
    const promise = new Promise(resolve => this.pending.push({ url, resolve }));
    this.requests.set(url, promise);
    this.pump();
    return promise;
  }

  pump() {
    while (this.active < 3 && this.pending.length) {
      const { url, resolve } = this.pending.shift();
      this.active += 1;
      this.decode(url).then(success => {
        this.active -= 1;
        // A future reveal may recover from a temporary connection failure.
        // This preparation resolves once; it does not immediately retry itself.
        if (!success) this.requests.delete(url);
        resolve(success);
        this.pump();
      });
    }
  }

  decode(url) {
    return new Promise(resolve => {
      let image, timer, settled = false, decoding = false;
      const finish = success => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (image) {
          image.onload = null;
          image.onerror = null;
          if (!success) image.removeAttribute?.('src');
        }
        resolve(success);
      };
      try {
        image = new Image();
        image.decoding = 'async';
        image.onload = () => {
          if (settled || decoding) return;
          decoding = true;
          Promise.resolve().then(() => image.decode?.()).then(() => finish(true), () => finish(false));
        };
        image.onerror = () => finish(false);
        // A missing response or stalled decode must not hold the loading screen.
        timer = setTimeout(() => finish(false), 12000);
        image.src = url;
        if (image.complete) {
          if (image.naturalWidth > 0) image.onload();
          else finish(false);
        }
      } catch {
        finish(false);
      }
    });
  }
}

export function sceneImages(root) {
  if (!root) return [];
  const own = root.getAttribute?.('data-src') ? [root] : [];
  return own.concat([...root.children].flatMap(sceneImages));
}
