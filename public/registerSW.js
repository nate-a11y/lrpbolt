if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { type: 'module' })
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.error('SW registration failed', err));
  });
}
