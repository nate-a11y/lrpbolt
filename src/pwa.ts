/* Proprietary and confidential. See LICENSE. */
import { Workbox } from 'workbox-window';

// Don’t register in unsupported or development environments
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  (async () => {
    try {
      const wb = new Workbox(swUrl, { scope: import.meta.env.BASE_URL });

      // When a new SW is waiting, auto-swap and reload
      wb.addEventListener('waiting', async () => {
        try {
          await wb.messageSW({ type: 'SKIP_WAITING' });
        } catch {}
        window.location.reload();
      });

      // If registration fails due to bad precache (404), unregister & hard reload
      wb.addEventListener('controlling', () => {
        // noop; ensures control without manual reload
      });

      const reg = await wb.register();

      // Extra safety: if install rejected (e.g., bad-precaching-response), purge SW
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', async () => {
          if (installing.state === 'redundant' && reg.active == null) {
            try { await reg.unregister(); } catch {}
            // Force a reload to fetch the new sw.js + manifest
            window.location.reload();
          }
        });
      });

      // periodic update check (default 30m)
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    } catch (e) {
      // Last-ditch: if anything goes wrong, attempt to unregister and reload
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      } catch {}
      // don’t loop; user refresh is enough
    }
  })();
}
