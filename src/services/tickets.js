/* Proprietary and confidential. See LICENSE. */
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import AppError from "@/utils/AppError.js";
import logError from "@/utils/logError.js";
import { toDayjs } from "@/utils/time";
import { db } from "@/services/firebase.js";
import { withExponentialBackoff } from "@/services/retry.js";
import { normalizeAssignee } from "@/lib/assignees.js";

import { COLLECTIONS } from "../constants/collections.js";

const TICKETS_COLLECTION = collection(db, COLLECTIONS.ISSUE_TICKETS);

export const DEFAULT_ASSIGNEES = {
  vehicle: normalizeAssignee({ userId: "jim", displayName: "Jim" }),
  marketing: normalizeAssignee({ userId: "michael", displayName: "Michael" }),
  tech: normalizeAssignee({ userId: "nate", displayName: "Nate" }),
  moovs: normalizeAssignee({ userId: "nate", displayName: "Nate" }),
};

function normalizeWatcherValue(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (typeof raw === "object") {
    const candidate =
      raw.userId || raw.uid || raw.email || raw.id || raw.value || null;
    if (!candidate) return null;
    const trimmed = String(candidate).trim();
    return trimmed || null;
  }
  return null;
}

function mergeWatchers(list) {
  const result = [];
  const seen = new Set();
  if (!Array.isArray(list)) return result;
  list.forEach((entry) => {
    const normalized = normalizeWatcherValue(entry);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
}

function normalizeTicketInput(input = {}) {
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  if (!title) {
    throw new AppError("Title is required", "TICKET_TITLE_REQUIRED");
  }
  if (!description) {
    throw new AppError(
      "Description is required",
      "TICKET_DESCRIPTION_REQUIRED",
    );
  }

  const category = String(input.category || "tech").toLowerCase();
  const priority = String(input.priority || "normal").toLowerCase();
  const createdBy = input.createdBy || {};
  if (!createdBy.userId) {
    throw new AppError("Creator missing userId", "TICKET_CREATOR_INVALID");
  }

  const preferredAssignee =
    input.assignee && Object.keys(input.assignee || {}).length
      ? normalizeAssignee(input.assignee)
      : null;
  const fallbackAssignee =
    DEFAULT_ASSIGNEES[category] || DEFAULT_ASSIGNEES.tech || {};
  const assigneeCandidate = preferredAssignee || fallbackAssignee;
  const assignee = normalizeAssignee(assigneeCandidate);
  const watcherCandidates = Array.isArray(input.watchers) ? input.watchers : [];
  const watchers = mergeWatchers([
    ...watcherCandidates,
    createdBy.userId,
    assignee?.userId,
  ]);

  return {
    payload: {
      title,
      description,
      category,
      priority,
      status: "open",
      createdBy: {
        userId: createdBy.userId,
        displayName: createdBy.displayName || "Unknown",
      },
      assignee,
      watchers,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    assignee,
  };
}

function mapTicketDoc(docSnap) {
  const data = docSnap.data() || {};
  const createdAt = toDayjs(data.createdAt);
  const updatedAt = toDayjs(data.updatedAt) || createdAt;
  const lastCommentAt = toDayjs(data.lastCommentAt);

  return {
    ...data,
    id: docSnap.id,
    title: data.title || "",
    createdAt,
    updatedAt,
    lastCommentAt,
  };
}

function isLegacySubscribeOptions(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (
    typeof value.onData === "function" ||
    typeof value.onError === "function" ||
    value.q != null
  );
}

function subscribeTicketsLegacy(options = {}) {
  const { onData, onError } = options;
  const qRef =
    options.q || query(TICKETS_COLLECTION, orderBy("createdAt", "desc"));
  return onSnapshot(
    qRef,
    (snapshot) => {
      const rows = [];
      snapshot.forEach((d) => {
        rows.push({ id: d.id, ...(d.data() || {}) });
      });
      onData?.(rows);
    },
    (error) => {
      logError(error, { area: "tickets", action: "subscribeTickets" });
      onError?.(error);
    },
  );
}

async function getNextIncidentNumber() {
  const counterRef = doc(db, "AdminMeta", "ticketCounter");

  try {
    const incidentNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let nextNumber = 1;
      if (counterDoc.exists()) {
        nextNumber = (counterDoc.data()?.lastIncidentNumber || 0) + 1;
      }

      transaction.set(counterRef, {
        lastIncidentNumber: nextNumber,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      return `INC-${String(nextNumber).padStart(4, "0")}`;
    });

    return incidentNumber;
  } catch (error) {
    logError(error, { where: "tickets.getNextIncidentNumber" });
    // Fallback to timestamp-based number if transaction fails
    return `INC-${Date.now()}`;
  }
}

export function subscribeTickets(filters = {}, callback) {
  if (isLegacySubscribeOptions(filters)) {
    return subscribeTicketsLegacy(filters);
  }

  const cb = typeof callback === "function" ? callback : () => {};

  try {
    let qRef = query(TICKETS_COLLECTION, orderBy("updatedAt", "desc"));
    if (filters?.status) {
      qRef = query(qRef, where("status", "==", String(filters.status)));
    }
    if (filters?.assignee) {
      qRef = query(qRef, where("assignee.userId", "==", filters.assignee));
    }

    return onSnapshot(
      qRef,
      (snapshot) => {
        if (snapshot.size) {
          const first = snapshot.docs[0];
          // eslint-disable-next-line no-console
          console.log("ticket sample", first.id, first.data());
        }
        const rows = snapshot.docs.map(mapTicketDoc);
        cb({ rows });
      },
      (error) => {
        logError(error, { where: "tickets.subscribeTickets" });
        cb({ error });
      },
    );
  } catch (error) {
    logError(error, { where: "tickets.subscribeTickets", phase: "init" });
    cb({ error });
    return () => {};
  }
}

export async function createTicket(input = {}) {
  try {
    const { payload, assignee } = normalizeTicketInput(input);

    // Generate incident number
    const incidentNumber = await getNextIncidentNumber();
    payload.incidentNumber = incidentNumber;

    const refId = await withExponentialBackoff(async () => {
      const ref = await addDoc(TICKETS_COLLECTION, payload);
      return ref.id;
    });

    const watchers = Array.isArray(payload.watchers) ? payload.watchers : [];

    return {
      id: refId,
      assignee,
      watchers,
      ticket: {
        title: payload.title,
        description: payload.description,
        category: payload.category,
        priority: payload.priority,
        status: payload.status,
        incidentNumber,
        createdBy: payload.createdBy,
      },
    };
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError(
            error?.message || "Failed to create ticket",
            "TICKET_CREATE_FAILED",
          );
    logError(appErr, { where: "tickets.createTicket" });
    throw appErr;
  }
}

export async function addTicketComment(ticketId, comment = {}) {
  const trimmed = String(comment.body ?? "").trim();
  if (!ticketId || !trimmed) {
    throw new AppError("Ticket comment missing", "TICKET_COMMENT_INVALID");
  }

  try {
    const commentsRef = collection(
      db,
      COLLECTIONS.ISSUE_TICKETS,
      ticketId,
      "comments",
    );
    await withExponentialBackoff(async () => {
      await setDoc(doc(commentsRef), {
        body: trimmed,
        author: comment.author || null,
        createdAt: serverTimestamp(),
      });
    });

    await updateDoc(doc(db, COLLECTIONS.ISSUE_TICKETS, ticketId), {
      updatedAt: serverTimestamp(),
      lastCommentAt: serverTimestamp(),
    });
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError(
            error?.message || "Failed to add ticket comment",
            "TICKET_COMMENT_FAILED",
            { ticketId },
          );
    logError(appErr, { where: "tickets.addTicketComment", ticketId });
    throw appErr;
  }
}

export async function updateTicket(ticketId, updates = {}) {
  const safeId = String(ticketId || "").trim();
  if (!safeId) {
    throw new AppError("Ticket id required", "TICKET_UPDATE_ID");
  }
  if (!updates || typeof updates !== "object") {
    throw new AppError("Update payload invalid", "TICKET_UPDATE_INVALID");
  }

  const payload = { ...updates };
  delete payload.id;

  if (Object.prototype.hasOwnProperty.call(payload, "assignee")) {
    const normalized = normalizeAssignee(payload.assignee);
    payload.assignee = Object.keys(normalized).length ? normalized : null;
  }

  payload.updatedAt = serverTimestamp();

  try {
    await withExponentialBackoff(async () => {
      await updateDoc(doc(db, COLLECTIONS.ISSUE_TICKETS, safeId), payload);
    });
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError(
            error?.message || "Failed to update ticket",
            "TICKET_UPDATE_FAILED",
            { ticketId: safeId },
          );
    logError(appErr, { where: "tickets.updateTicket", ticketId: safeId });
    throw appErr;
  }
}

export async function addWatcher(ticketId, userId) {
  const safeId = String(ticketId || "").trim();
  const safeUser = String(userId || "").trim();
  if (!safeId || !safeUser) {
    return;
  }

  try {
    await withExponentialBackoff(async () => {
      await updateDoc(doc(db, COLLECTIONS.ISSUE_TICKETS, safeId), {
        watchers: arrayUnion(safeUser),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError(
            error?.message || "Failed to add watcher",
            "TICKET_ADD_WATCHER_FAILED",
            { ticketId: safeId, userId: safeUser },
          );
    logError(appErr, { where: "tickets.addWatcher", ticketId: safeId });
    throw appErr;
  }
}

export async function snapshotTicketsByIds(ids = []) {
  if (!ids?.length) return [];
  const results = [];
  try {
    await Promise.all(
      ids.map(async (id) => {
        const ref = doc(db, COLLECTIONS.ISSUE_TICKETS, id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          results.push({ id, data: snap.data() });
        }
      }),
    );
  } catch (err) {
    logError(err, {
      area: "tickets",
      action: "snapshotTicketsByIds",
      ids,
    });
    throw err;
  }
  return results;
}

export async function deleteTicketsByIds(ids = []) {
  if (!ids?.length) return;
  const batch = writeBatch(db);
  try {
    ids.forEach((id) => {
      const ref = doc(db, COLLECTIONS.ISSUE_TICKETS, id);
      batch.delete(ref);
    });
    await batch.commit();
  } catch (err) {
    logError(err, { area: "tickets", action: "deleteTicketsByIds", ids });
    throw err;
  }
}

export async function restoreTickets(deletedDocs = []) {
  if (!deletedDocs?.length) return;
  const batch = writeBatch(db);
  try {
    deletedDocs.forEach(({ id, data }) => {
      const ref = doc(db, COLLECTIONS.ISSUE_TICKETS, id);
      batch.set(ref, data, { merge: false });
    });
    await batch.commit();
  } catch (err) {
    logError(err, {
      area: "tickets",
      action: "restoreTickets",
      count: deletedDocs.length,
    });
    throw err;
  }
}
