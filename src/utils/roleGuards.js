import { NAV_ITEMS } from "../config/nav";

export function canSeeNav(id, role = "driver") {
  const item = NAV_ITEMS.find((i) => i.id === id);
  if (!item) return false;
  const r = role || "driver";
  return item.rolesVisible.includes(r);
}

export function canAccessRoute(path, role = "driver") {
  const r = role || "driver";
  if (r === "shootout") return path === "/shootout";
  return true;
}
