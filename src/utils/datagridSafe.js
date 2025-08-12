export const safeGetter = (fn) => (params) => {
  try {
    return fn?.(params) ?? null;
  } catch {
    /* ignore */
    return null;
  }
};

export const safeFormatter = (fn) => (params) => {
  try {
    return fn?.(params) ?? '';
  } catch {
    /* ignore */
    return '';
  }
};
