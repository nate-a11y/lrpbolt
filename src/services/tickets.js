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

import { COLLECTIONS } from "../constants/collections.js";

const TICKETS_COLLECTION = collection(db, COLLECTIONS.ISSUE_TICKETS);

export const DEFAULT_ASSIGNEES = {
  vehicle: { userId: "jim", displayName: "Jim" },
  marketing: { userId: "michael", displayName: "Michael" },
  tech: { userId: "nate", displayName: "Nate" },
  moovs: { userId: "nate", displayName: "Nate" },
};

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

  const assignee = DEFAULT_ASSIGNEES[category] || DEFAULT_ASSIGNEES.tech;
  const watchers = Array.from(
    new Set([createdBy.userId, assignee?.userId].filter(Boolean)),
  );

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
  return {
    ...data,
    id: docSnap.id,
    createdAt: toDayjs(data.createdAt),
    updatedAt: toDayjs(data.updatedAt),
    lastCommentAt: toDayjs(data.lastCommentAt),
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
    const { payload } = normalizeTicketInput(input);
    const refId = await withExponentialBackoff(async () => {
      const ref = await addDoc(TICKETS_COLLECTION, payload);
      return ref.id;
    });
    return refId;
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

  const payload = { ...updates, updatedAt: serverTimestamp() };
  delete payload.id;

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
