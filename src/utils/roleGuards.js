import { NAV_ITEMS } from "../config/nav";

const NAV_ALIASES = {
  escalation: "directory",
};

export function canSeeNav(id, role = "driver") {
  const targetId = id ? NAV_ALIASES[id] || id : undefined;
  const item = NAV_ITEMS.find((i) => i.id === targetId);
  if (!item) return false;
  const r = role || "driver";
  return item.rolesVisible.includes(r);
}

export function canAccessRoute(path, role = "driver") {
  const r = role || "driver";
  if (r === "shootout") {
    return ["/shootout", "/directory", "/escalation"].includes(path);
  }
  return true;
}
