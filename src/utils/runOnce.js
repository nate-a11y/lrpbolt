// Simple guard to ensure a function runs only once per session
const RUN_MAP = new Set();

export function runOnce(key, fn) {
  if (RUN_MAP.has(key)) return;
  RUN_MAP.add(key);
  fn();
}
