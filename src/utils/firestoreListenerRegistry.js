/* Proprietary and confidential. See LICENSE. */
import { onSnapshot } from "firebase/firestore";

// Map<key, {unsub: fn, refs: number}>
const REG = new Map();
let MAX_DEV_LISTENERS = 200; // dev guard

export function subscribeOnce(key, query, next, error) {
  if (!query) return () => {};
  if (REG.has(key)) {
    const item = REG.get(key);
    item.refs += 1;
    return () => release(key);
  }
  const unsub = onSnapshot(query, next, error);
  REG.set(key, { unsub, refs: 1 });
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[FS] + ${key} | active=${REG.size}`);
    if (REG.size > MAX_DEV_LISTENERS) {
      console.warn(`[FS] runaway listeners detected (${REG.size})`);
      // Optional: throw to catch in dev
      // throw new Error("Runaway Firestore listeners");
    }
  }
  return () => release(key);
}

function release(key) {
  const item = REG.get(key);
  if (!item) return;
  item.refs -= 1;
  if (item.refs <= 0) {
    try { item.unsub?.(); } catch { /* noop */ }
    REG.delete(key);
    if (import.meta.env.DEV) console.debug(`[FS] - ${key} | active=${REG.size}`);
  }
}

export function killAllListeners() {
  for (const [key, item] of REG.entries()) {
    try { item.unsub?.(); } catch { /* noop */ }
    REG.delete(key);
  }
  if (import.meta.env.DEV) console.debug("[FS] all listeners killed");
}

export function activeListenerCount() { return REG.size; }

// handy dev kill switch
if (typeof window !== "undefined") {
  window.__FS_KILL__ = killAllListeners;
  window.__FS_COUNT__ = activeListenerCount;
}
