/* Proprietary and confidential. See LICENSE. */
// Global API request monitor
const requestMap = new Map();
let intervalId = null;

export function logRequest(method, url) {
  const key = `${method.toUpperCase()} ${url}`;
  const entry = requestMap.get(key);
  if (entry) {
    entry.count += 1;
  } else {
    requestMap.set(key, { count: 1, start: Date.now() });
  }
}

export function startMonitoring() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    if (requestMap.size === 0) return;
    const now = Date.now();
    const table = [];
    requestMap.forEach((value, key) => {
      const perMin = value.count / ((now - value.start) / 60000);
      table.push({
        endpoint: key,
        count: value.count,
        perMin: perMin.toFixed(1),
      });
      if (perMin > 50) {
        console.warn(
          `⚠️ High request volume: ${key} @ ${perMin.toFixed(1)} req/min`,
        );
      }
    });
    console.table(table);
  }, 5000);
}

export function stopMonitoring() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  requestMap.clear();
}
