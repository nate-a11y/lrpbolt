import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New content available, refresh needed.');
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline.');
  },
  onRegistered(registration) {
    console.log('[PWA] Service worker registered:', registration);
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error);
  },
});
