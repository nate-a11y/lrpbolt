import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New content available; please refresh.');
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline.');
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error);
  },
});
