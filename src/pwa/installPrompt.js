/* Proprietary and confidential. See LICENSE. */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
});

export async function showInstallPromptIfReady() {
  if (!deferredInstall) return false;
  try {
    await deferredInstall.prompt();
    deferredInstall = null;
    return true;
  } catch {
    return false;
  }
}
