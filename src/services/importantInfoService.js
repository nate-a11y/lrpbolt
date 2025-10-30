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
  where,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db } from "@/services/firebase.js";
import { withExponentialBackoff } from "@/services/retry.js";
import { AppError } from "@/services/errors";
import logError from "@/utils/logError.js";
import { getLRPFunctions } from "@/utils/functions.js";
import { PROMO_PARTNER_CATEGORIES } from "@/constants/importantInfo.js";
import { deleteImportantInfoImage } from "@/services/importantInfoImageService.js";
import {
  logAuditEntry,
  computeChanges,
} from "@/services/importantInfoAuditLog.js";

const COLLECTION = "importantInfo";

let seedCallable = null;

function getSeedCallable() {
  if (seedCallable) return seedCallable;
  seedCallable = httpsCallable(getLRPFunctions(), "seedImportantInfoOnce");
  return seedCallable;
}

function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value) {
  const trimmed = safeTrim(value);
  return trimmed ? trimmed : null;
}

function sanitizePayload(payload = {}, isCreate = false) {
  const base = {};

  // For creates, we need to ensure required fields have defaults
  // For updates, we only include fields that are explicitly provided

  // title - required field
  if (payload.title !== undefined || isCreate) {
    base.title = safeTrim(payload.title) || "Untitled";
  }

  // blurb - optional field
  if (payload.blurb !== undefined) {
    base.blurb = safeTrim(payload.blurb);
  }

  // details - optional field
  if (payload.details !== undefined) {
    base.details = safeTrim(payload.details);
  }

  // category - required field for creates
  if (payload.category !== undefined || isCreate) {
    base.category =
      safeTrim(payload.category) || PROMO_PARTNER_CATEGORIES[0] || "Promotions";
  }

  // phone - optional field
  if (payload.phone !== undefined) {
    base.phone = nullable(payload.phone);
  }

  // url - optional field
  if (payload.url !== undefined) {
    base.url = nullable(payload.url);
  }

  // smsTemplate - optional field
  if (payload.smsTemplate !== undefined) {
    base.smsTemplate = nullable(payload.smsTemplate);
  }

  // isActive - default to true for creates, otherwise only if provided
  if (payload.isActive !== undefined || isCreate) {
    base.isActive = typeof payload.isActive === "boolean" ? payload.isActive : true;
  }

  // Only include images if provided (don't overwrite existing with empty array)
  if (payload.images !== undefined) {
    base.images = Array.isArray(payload.images) ? payload.images : [];
  }

  // Include sendCount if provided (for SMS tracking)
  if (payload.sendCount !== undefined) {
    base.sendCount =
      typeof payload.sendCount === "number" ? payload.sendCount : 0;
  }

  // Include order if provided (for drag-and-drop ordering)
  if (payload.order !== undefined) {
    base.order = typeof payload.order === "number" ? payload.order : 0;
  }

  // Include publishDate if provided (for scheduled publishing)
  if (payload.publishDate !== undefined) {
    base.publishDate = payload.publishDate;
  }

  return base;
}

function mapSnapshot(docSnap) {
  if (!docSnap) return null;
  const data = typeof docSnap.data === "function" ? docSnap.data() : null;
  if (!data) {
    return { id: docSnap.id };
  }
  return { id: docSnap.id, ...data };
}

export function subscribeImportantInfo({ onData, onError } = {}) {
  const ref = collection(db, COLLECTION);
  const q = query(
    ref,
    where("category", "in", PROMO_PARTNER_CATEGORIES),
    orderBy("updatedAt", "desc"),
  );
  try {
    return onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map(mapSnapshot).filter((item) => {
          if (!item) return false;
          const label = item?.category ? String(item.category) : "";
          return PROMO_PARTNER_CATEGORIES.includes(label);
        });
        if (onData) onData(rows);
      },
      (error) => {
        const appErr =
          error instanceof AppError
            ? error
            : new AppError("Failed to subscribe to important info", {
                code: "importantinfo_subscribe",
                cause: error,
              });
        logError(error, {
          where: "importantInfoService.subscribe",
          action: "onSnapshot",
        });
        if (onError) onError(appErr);
      },
    );
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to initialize important info subscription", {
            code: "importantinfo_subscribe_init",
            cause: error,
          });
    logError(error, {
      where: "importantInfoService.subscribe",
      action: "init",
    });
    if (onError) onError(appErr);
    return () => {};
  }
}

export async function createImportantInfo(payload, userContext = null) {
  const data = sanitizePayload(payload, true);
  try {
    const itemId = await withExponentialBackoff(async () => {
      const ref = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    });

    // Log audit entry
    if (userContext) {
      await logAuditEntry(itemId, {
        action: "create",
        user: userContext,
        metadata: {
          title: data.title,
          category: data.category,
        },
      });
    }

    return itemId;
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to create important info", {
            code: "importantinfo_create",
            cause: error,
          });
    logError(error, {
      where: "importantInfoService.create",
      payload: { title: data.title, category: data.category },
    });
    throw appErr;
  }
}

export async function updateImportantInfo(
  id,
  changes,
  userContext = null,
  previousState = null,
) {
  if (!id) {
    throw new AppError("Missing important info id", {
      code: "importantinfo_missing_id",
    });
  }
  const patch = sanitizePayload(changes);
  try {
    await withExponentialBackoff(async () => {
      await updateDoc(doc(db, COLLECTION, id), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    });

    // Log audit entry
    if (userContext && previousState) {
      const fieldChanges = computeChanges(previousState, {
        ...previousState,
        ...patch,
      });
      if (fieldChanges) {
        await logAuditEntry(id, {
          action: "update",
          user: userContext,
          changes: fieldChanges,
        });
      }
    }
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to update important info", {
            code: "importantinfo_update",
            context: { id },
            cause: error,
          });
    logError(error, {
      where: "importantInfoService.update",
      payload: { id, title: patch.title },
    });
    throw appErr;
  }
}

export async function deleteImportantInfo(id, userContext = null) {
  if (!id) {
    throw new AppError("Missing important info id", {
      code: "importantinfo_missing_id",
    });
  }
  try {
    // Get the document to check if it has images
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    const data = docSnap.exists() ? docSnap.data() : null;

    // Log audit entry before deletion
    if (userContext && data) {
      await logAuditEntry(id, {
        action: "delete",
        user: userContext,
        metadata: {
          title: data.title,
          category: data.category,
        },
      });
    }

    await withExponentialBackoff(async () => {
      await deleteDoc(docRef);
    });

    // Delete associated images from storage if they exist
    if (data?.images && Array.isArray(data.images)) {
      for (const image of data.images) {
        if (image?.storagePath) {
          try {
            await deleteImportantInfoImage(image.storagePath);
          } catch (imageError) {
            // Log but don't fail the delete operation if image deletion fails
            logError(imageError, {
              where: "importantInfoService.delete.image",
              payload: { id, storagePath: image.storagePath },
            });
          }
        }
      }
    }
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to delete important info", {
            code: "importantinfo_delete",
            context: { id },
            cause: error,
          });
    logError(error, {
      where: "importantInfoService.delete",
      payload: { id },
    });
    throw appErr;
  }
}

export async function bulkCreateImportantInfo(items = []) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return 0;

  const chunkSize = 500;
  const colRef = collection(db, COLLECTION);
  let total = 0;

  for (let index = 0; index < list.length; index += chunkSize) {
    const slice = list.slice(index, index + chunkSize);
    try {
      await withExponentialBackoff(async () => {
        const batch = writeBatch(db);
        slice.forEach((raw) => {
          const ref = doc(colRef);
          const payload = {
            ...sanitizePayload(raw, true),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          batch.set(ref, payload);
        });
        await batch.commit();
      });
      total += slice.length;
    } catch (error) {
      logError(error, {
        where: "importantInfoService.bulkCreate",
        payload: { chunkSize: slice.length },
      });
      const appErr =
        error instanceof AppError
          ? error
          : new AppError("Failed to import important info", {
              code: "importantinfo_bulk_create",
              cause: error,
            });
      throw appErr;
    }
  }

  return total;
}

export async function restoreImportantInfo(item, userContext = null) {
  const id = item?.id;
  if (!id) {
    throw new AppError("Missing important info id", {
      code: "importantinfo_missing_id",
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

    // Log audit entry
    if (userContext) {
      await logAuditEntry(id, {
        action: "restore",
        user: userContext,
        metadata: {
          title: payload.title,
          category: payload.category,
        },
      });
    }
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to restore important info", {
            code: "importantinfo_restore",
            context: { id },
            cause: error,
          });
    logError(error, {
      where: "importantInfoService.restore",
      payload: { id },
    });
    throw appErr;
  }
}

export async function seedImportantInfoDefaults() {
  try {
    const callable = getSeedCallable();
    const response = await callable({});
    return response?.data || { ok: true, count: 0 };
  } catch (error) {
    logError(error, {
      where: "importantInfoService.seedDefaults",
    });
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to seed important info", {
            code: "importantinfo_seed",
            cause: error,
          });
    throw appErr;
  }
}
