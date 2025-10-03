/* LRP Portal enhancement: FS service shim (Phase-1), 2025-10-03. */
import {
  getDb,
  collection,
  doc,
  getDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
} from "../firestoreCore";
import { withExponentialBackoff } from "../retry";
import { AppError, logError } from "../errors";

/** ---- Tickets ---- */
const TICKETS = "tickets";

export async function getTicketById(ticketId) {
  if (!ticketId) throw new AppError("ticketId required", { code: "bad_args" });
  const db = getDb();
  const ref = doc(db, TICKETS, ticketId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeTickets({ q = null, onData, onError } = {}) {
  const db = getDb();
  const baseRef = collection(db, TICKETS);
  const compiled = q || query(baseRef, orderBy("createdAt", "desc"));
  const unsub = onSnapshot(
    compiled,
    (qs) => {
      const rows = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (onData) onData(rows);
    },
    (err) => {
      logError(err, { where: "subscribeTickets" });
      if (onError) onError(err);
    },
  );
  return unsub;
}

export async function deleteTicketsBatch(ids = []) {
  if (!Array.isArray(ids) || !ids.length) return;
  const db = getDb();
  await withExponentialBackoff(async () => {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      if (!id) return;
      batch.delete(doc(db, TICKETS, id));
    });
    await batch.commit();
  });
}

/** Re-create docs from captured snapshots (for true Undo) */
export async function restoreTicketsBatch(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return;
  const db = getDb();
  await withExponentialBackoff(async () => {
    const batch = writeBatch(db);
    rows.forEach((r) => {
      const { id, ...data } = r || {};
      if (!id) return;
      batch.set(doc(db, TICKETS, id), data, { merge: true });
    });
    await batch.commit();
  });
}

/** ---- TimeLogs Façade (Phase-1) ----
 * Delegates to existing legacy service if available, else provides no-op stubs
 * so imports can migrate gradually without breaking.
 */
let legacyModule;
let legacyLoaded = false;
async function ensureLegacy() {
  if (legacyLoaded) return legacyModule;
  try {
    legacyModule = await import("../timeLogs.js");
  } catch (e) {
    legacyModule = null;
    logError(e, { where: "services.fs.ensureLegacy" });
  }
  legacyLoaded = true;
  return legacyModule;
}

function getLegacyTimeLogs() {
  if (!legacyModule) return null;
  return legacyModule.timeLogs || legacyModule.default || legacyModule;
}

export const timeLogs = {
  async logTime(entry) {
    const legacy =
      getLegacyTimeLogs() || (await ensureLegacy(), getLegacyTimeLogs());
    if (legacy?.logTime) return legacy.logTime(entry);
    throw new AppError("logTime not yet migrated; legacy missing", {
      code: "not_implemented",
    });
  },
  subscribe(cb, onErr) {
    let unsubscribe = () => {};
    ensureLegacy()
      .then(() => {
        const legacy = getLegacyTimeLogs();
        if (legacy?.subscribeTimeLogs) {
          unsubscribe = legacy.subscribeTimeLogs(cb, onErr);
        } else {
          logError(
            new AppError("subscribeTimeLogs not yet migrated", {
              code: "not_implemented",
            }),
          );
        }
      })
      .catch((err) => {
        logError(err, { where: "services.fs.timeLogs.subscribe" });
        if (onErr) onErr(err);
      });
    return () => {
      if (typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch (err) {
          logError(err, { where: "services.fs.timeLogs.unsubscribe" });
        }
      }
    };
  },
};
