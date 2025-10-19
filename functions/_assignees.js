const ALIAS_EMAIL = {
  nate: "nate@lakeridepros.com",
  michael: "michael@lakeridepros.com",
  jim: "jim@lakeridepros.com",
};

function normalizeString(value) {
  if (!value && value !== 0) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}

function resolveEmailFromId(idOrEmail) {
  const raw = normalizeString(idOrEmail).toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  return ALIAS_EMAIL[raw] || "";
}

function normalizeAssignee(input = {}) {
  const source =
    typeof input === "string" || typeof input === "number"
      ? { userId: String(input) }
      : input || {};

  const explicitEmail = normalizeString(source.email).toLowerCase();
  const derivedEmail = explicitEmail || resolveEmailFromId(source.userId);
  const displayName = normalizeString(source.displayName);
  let userId = normalizeString(source.userId);

  if (!userId && derivedEmail) {
    userId = derivedEmail.split("@")[0];
  }

  const assignee = {};
  if (userId) assignee.userId = userId;
  if (derivedEmail) assignee.email = derivedEmail;
  if (displayName) assignee.displayName = displayName;

  return assignee;
}

module.exports = {
  ALIAS_EMAIL,
  resolveEmailFromId,
  normalizeAssignee,
};
