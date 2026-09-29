import { prepareStartup, loadCoverImage, withTimeout } from './loading-resources.js';
import { createLoadingScreen } from './loading-screen.js';

const loader = createLoadingScreen();
loader.show();

try {
  const { app } = await prepareStartup({
    loadApp: () => withTimeout(import('./main.js'), 20000, '旅程暂时未能展开'),
    loadCover: () => loadCoverImage(`${import.meta.env.BASE_URL}assets/cover-watercolor-v4.webp`),
    // Font loading has a short deadline; system fonts are a complete fallback.
    loadFonts: () => withTimeout(Promise.all([
      document.fonts.load('16px JourneyHand'), document.fonts.load('16px JourneyDisplay'),
    ]), 1800),
    onProgress: loader.update,
  });
  await loader.finish();
  app.showCover();
} catch (error) {
  console.warn('Journey could not start:', error);
  loader.error();
}
