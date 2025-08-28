export const safeRow = (params) =>
  params && typeof params === "object" && "row" in params ? params.row : null;

export const toIdArray = (input) => {
  if (Array.isArray(input)) return input;
  if (!input) return [];
  if (input instanceof Set) return Array.from(input);
  if (typeof input === "object") {
    if (Array.isArray(input.ids)) return input.ids;
    if (input.ids instanceof Set) return Array.from(input.ids);
    if (input.id != null) return [input.id];
    if (Array.isArray(input.current)) return input.current;
  }
  return [];
};
