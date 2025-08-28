import { fetchWithRetry } from "./network";
import logError from "./logError.js";

export async function fetchWithCache(key, url, ttl = 86400000) {
  const cached = localStorage.getItem(key);
  const expires = localStorage.getItem(`${key}_exp`);
  const now = Date.now();
  if (cached && expires && now < parseInt(expires, 10)) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      logError(err, "fetchWithCache:parse");
      // fall through to fetch on parse error
    }
  }
  const res = await fetchWithRetry(url);
  const data = await res.json();
  localStorage.setItem(key, JSON.stringify(data));
  localStorage.setItem(`${key}_exp`, now + ttl);
  return data;
}
