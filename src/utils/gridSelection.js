export function toArraySelection(model) {
  if (Array.isArray(model)) return model;
  if (model == null) return [];
  if (typeof model === "object" && typeof model.size === "number")
    return Array.from(model);
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
