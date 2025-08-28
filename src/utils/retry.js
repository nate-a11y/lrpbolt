import AppError from "./AppError.js";

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export default async function retry(fn, options = {}) {
  const {
    tries = 3,
    min = 300,
    max = 2500,
    factor = 2,
    jitter = true,
    onError,
    signal,
  } = options;
  let attempt = 0;
  let delay = min;
  let lastErr;
  while (attempt < tries) {
    if (signal?.aborted) {
      throw new AppError("Aborted", "ABORTED");
    }
    try {
      return await fn({ signal });
    } catch (err) {
      lastErr = err instanceof AppError ? err : new AppError(err.message || err, "RETRY_FAIL");
      onError?.(lastErr, attempt + 1);
      attempt += 1;
      if (attempt >= tries) break;
      let wait = delay;
      if (jitter) {
        wait += Math.random() * delay * 0.5;
      }
      await sleep(wait, signal);
      delay = Math.min(max, delay * factor);
    }
  }
  throw lastErr;
}

