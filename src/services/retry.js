/* LRP Portal enhancement: exponential backoff, 2025-10-03. */
export async function withExponentialBackoff(
  fn,
  { tries = 3, base = 200, jitter = true } = {},
) {
  let attempt = 0;
  let lastErr;
  while (attempt < tries) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      attempt += 1;
      if (attempt >= tries) break;
      const wait = base * 2 ** (attempt - 1);
      const sleep = jitter ? Math.floor(wait * (0.5 + Math.random())) : wait;
      await new Promise((r) => setTimeout(r, sleep));
    }
  }
  throw lastErr;
}
