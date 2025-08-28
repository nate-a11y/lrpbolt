export function toV8Model(input) {
  if (!input) return { ids: new Set(), type: "include" };
  if (Array.isArray(input)) return { ids: new Set(input), type: "include" };
  if (input instanceof Set) return { ids: input, type: "include" };
  if (typeof input === "object") {
    const rawIds = input.ids;
    let ids;
    if (rawIds instanceof Set) {
      ids = rawIds;
    } else if (Array.isArray(rawIds)) {
      ids = new Set(rawIds);
    } else if (
      rawIds &&
      typeof rawIds === "object" &&
      Array.isArray(rawIds.current)
    ) {
      ids = new Set(rawIds.current);
    } else if (input.id != null) {
      ids = new Set([input.id]);
    } else {
      ids = new Set();
    }
    const type = input.type === "exclude" ? "exclude" : "include";
    return { ids, type };
  }
  return { ids: new Set(), type: "include" };
}

export function idsArray(model) {
  // Convenience for callers that need an array version
  if (model && model.ids instanceof Set) return Array.from(model.ids);
  return [];
}

export function selectedCount(model) {
  return model && model.ids instanceof Set ? model.ids.size : 0;
}
