import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/services/firebase.js";
import { withExponentialBackoff } from "@/services/retry.js";
import { AppError } from "@/services/errors";
import logError from "@/utils/logError.js";

const COLLECTION = "reservationNotes";

function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizePayload(payload = {}, isPartialUpdate = false) {
  if (isPartialUpdate) {
    // For partial updates (like toggling active status), only include provided fields
    const result = {};
    if ("title" in payload) {
      result.title = safeTrim(payload.title) || "Untitled";
    }
    if ("noteTemplate" in payload) {
      result.noteTemplate = safeTrim(payload.noteTemplate);
    }
    if ("isActive" in payload) {
      result.isActive =
        typeof payload.isActive === "boolean" ? payload.isActive : true;
    }
    return result;
  }

  // For full document creation/replacement
  return {
    title: safeTrim(payload.title) || "Untitled",
    noteTemplate: safeTrim(payload.noteTemplate),
    isActive: typeof payload.isActive === "boolean" ? payload.isActive : true,
  };
}

function mapSnapshot(docSnap) {
  if (!docSnap) return null;
  const data = typeof docSnap.data === "function" ? docSnap.data() : null;
  if (!data) {
    return { id: docSnap.id };
  }
  return { id: docSnap.id, ...data };
}

export function subscribeNotes({ onData, onError } = {}) {
  const ref = collection(db, COLLECTION);
  const q = query(ref, orderBy("updatedAt", "desc"));
  try {
    return onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map(mapSnapshot).filter(Boolean);
        if (onData) onData(rows);
      },
      (error) => {
        const appErr =
          error instanceof AppError
            ? error
            : new AppError("Failed to subscribe to notes", {
                code: "notes_subscribe",
                cause: error,
              });
        logError(error, {
          where: "notesService.subscribe",
          action: "onSnapshot",
        });
        if (onError) onError(appErr);
      },
    );
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to initialize notes subscription", {
            code: "notes_subscribe_init",
            cause: error,
          });
    logError(error, {
      where: "notesService.subscribe",
      action: "init",
    });
    if (onError) onError(appErr);
    return () => {};
  }
}

export async function createNote(payload) {
  const data = sanitizePayload(payload);
  try {
    return await withExponentialBackoff(async () => {
      const ref = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    });
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to create note", {
            code: "notes_create",
            cause: error,
          });
    logError(error, {
      where: "notesService.create",
      payload: { title: data.title },
    });
    throw appErr;
  }
}

export async function updateNote(id, changes) {
  if (!id) {
    throw new AppError("Missing note id", {
      code: "notes_missing_id",
    });
  }
  const patch = sanitizePayload(changes, true); // Pass true for partial update
  try {
    await withExponentialBackoff(async () => {
      await updateDoc(doc(db, COLLECTION, id), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to update note", {
            code: "notes_update",
            context: { id },
            cause: error,
          });
    logError(error, {
      where: "notesService.update",
      payload: { id, title: patch.title },
    });
    throw appErr;
  }
}

export async function deleteNote(id) {
  if (!id) {
    throw new AppError("Missing note id", {
      code: "notes_missing_id",
    });
  }
  try {
    await withExponentialBackoff(async () => {
      await deleteDoc(doc(db, COLLECTION, id));
    });
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to delete note", {
            code: "notes_delete",
            context: { id },
            cause: error,
          });
    logError(error, {
      where: "notesService.delete",
      payload: { id },
    });
    throw appErr;
  }
}

export async function restoreNote(item) {
  const id = item?.id;
  if (!id) {
    throw new AppError("Missing note id", {
      code: "notes_missing_id",
    });
  }
  const { id: _, ...data } = item || {};
  const payload = { ...data };
  if (!payload.createdAt) {
    payload.createdAt = serverTimestamp();
  }
  payload.updatedAt = serverTimestamp();

  try {
    await withExponentialBackoff(async () => {
      await setDoc(doc(db, COLLECTION, id), payload, { merge: false });
    });
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to restore note", {
            code: "notes_restore",
            context: { id },
            cause: error,
          });
    logError(error, {
      where: "notesService.restore",
      payload: { id },
    });
    throw appErr;
  }
}
