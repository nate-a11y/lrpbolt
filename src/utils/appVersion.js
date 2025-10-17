/* global __APP_VERSION__ */
let cachedVersion = null;

export function getAppVersion() {
  if (cachedVersion) return cachedVersion;
  if (typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__) {
    cachedVersion = __APP_VERSION__;
    return cachedVersion;
  }
  const metaEnv = import.meta.env;
  const envVersion = metaEnv && metaEnv.VITE_APP_VERSION;
  if (envVersion) {
    cachedVersion = envVersion;
    return cachedVersion;
  }
  cachedVersion = "dev";
  return cachedVersion;
}

export default getAppVersion;
