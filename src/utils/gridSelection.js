export function toArraySelection(model) {
  if (model == null) return [];
  if (Array.isArray(model)) return model;
  if (model instanceof Set) return Array.from(model);
  if (typeof model === "object") {
    // Handle model.ids property - check if it exists and is iterable
    if ("ids" in model) {
      if (model.ids == null) return [];
      if (Array.isArray(model.ids)) return model.ids;
      if (model.ids instanceof Set) return Array.from(model.ids);
      // If ids exists but is not iterable, return empty array
      return [];
    }
    if (typeof model.size === "number") return Array.from(model);
    if (model.id != null) return [model.id];
  }
  return [model];
}

export function safeGetRowId(row) {
  return (
    row?.id ??
    row?.docId ??
    row?.docID ??
    row?._id ??
    row?.rideId ??
    row?.rideID ??
    row?.key ??
    String(
      row?.uid ??
        row?.rid ??
        row?.timestamp ??
        Math.random().toString(36).slice(2),
    )
  );
}
