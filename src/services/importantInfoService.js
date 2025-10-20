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
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db } from "@/services/firebase.js";
import { withExponentialBackoff } from "@/services/retry.js";
import { AppError } from "@/services/errors";
import logError from "@/utils/logError.js";
import { getLRPFunctions } from "@/utils/functions.js";
import { PROMO_PARTNER_CATEGORIES } from "@/constants/importantInfo.js";

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

function sanitizePayload(payload = {}) {
  return {
    title: safeTrim(payload.title) || "Untitled",
    blurb: safeTrim(payload.blurb),
    details: safeTrim(payload.details),
    category: safeTrim(payload.category) || "General",
    phone: nullable(payload.phone),
    url: nullable(payload.url),
    smsTemplate: nullable(payload.smsTemplate),
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

export async function createImportantInfo(payload) {
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

export async function updateImportantInfo(id, changes) {
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

export async function deleteImportantInfo(id) {
  if (!id) {
    throw new AppError("Missing important info id", {
      code: "importantinfo_missing_id",
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
            ...sanitizePayload(raw),
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

export async function restoreImportantInfo(item) {
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
