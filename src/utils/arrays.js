export function asArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  try {
    return Array.from(v);
  } catch {
    return [];
  }
}
