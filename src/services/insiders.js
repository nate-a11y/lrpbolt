import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit as limitQuery,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/services/firebase.js";
import { withExponentialBackoff } from "@/services/retry.js";
import { AppError } from "@/services/errors.js";
import logError from "@/utils/logError.js";

const COLLECTION = "insiderMembers";

function mapDoc(docSnap) {
  if (!docSnap) return null;
  const data = typeof docSnap.data === "function" ? docSnap.data() : null;
  if (!data) return { id: docSnap.id };
  return { id: docSnap.id, ...data };
}

function sanitizeMembers(members) {
  if (!Array.isArray(members)) return [];
  return members
    .map((member) => {
      if (!member) return null;
      const name = typeof member.name === "string" ? member.name.trim() : "";
      if (!name) return null;
      const entry = { name };
      if (typeof member.role === "string" && member.role.trim()) {
        entry.role = member.role.trim();
      }
      if (typeof member.phone === "string" && member.phone.trim()) {
        entry.phone = member.phone.trim();
      }
      if (typeof member.email === "string" && member.email.trim()) {
        entry.email = member.email.trim();
      }
      return entry;
    })
    .filter(Boolean);
}

function sanitize(payload = {}) {
  const out = {};
  const allowed = [
    "name",
    "membershipType",
    "level",
    "points",
    "members",
    "notes",
    "isActive",
  ];

  allowed.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      return;
    }
    const value = payload[key];
    if (value !== undefined) {
      out[key] = value;
    }
  });

  if (typeof out.name === "string") {
    out.name = out.name.trim();
  }

  if (typeof out.membershipType === "string") {
    out.membershipType = out.membershipType.trim().toLowerCase();
  }

  if (typeof out.level === "string") {
    out.level = out.level.trim().toLowerCase();
  }

  if (
    out.membershipType === "individual" &&
    Object.prototype.hasOwnProperty.call(out, "members")
  ) {
    delete out.members;
  } else if (Array.isArray(out.members)) {
    out.members = sanitizeMembers(out.members);
  }

  if (Object.prototype.hasOwnProperty.call(out, "points")) {
    const numericPoints = Number(out.points);
    out.points = Number.isFinite(numericPoints) ? numericPoints : 0;
  }

  if (Object.prototype.hasOwnProperty.call(out, "isActive")) {
    out.isActive = out.isActive !== false;
  }

  if (
    Object.prototype.hasOwnProperty.call(out, "notes") &&
    typeof out.notes === "string"
  ) {
    out.notes = out.notes.trim();
  }

  return out;
}

export function subscribeInsiders({ limit = 1000 } = {}, cb) {
  const callback = typeof cb === "function" ? cb : () => {};
  const ref = collection(db, COLLECTION);
  const q = query(ref, orderBy("name", "asc"), limitQuery(limit));

  try {
    return onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map(mapDoc).filter(Boolean);
        callback({ rows, error: null });
      },
      (error) => {
        logError(error, {
          where: "insiders.subscribe",
          action: "onSnapshot",
        });
        callback({ rows: [], error });
      },
    );
  } catch (error) {
    logError(error, {
      where: "insiders.subscribe",
      action: "init",
    });
    callback({ rows: [], error });
    return () => {};
  }
}

export async function createInsider(payload = {}) {
  const data = sanitize(payload);
  if (!data.name) {
    throw new AppError("Insider member requires a name", {
      code: "insiders_missing_name",
    });
  }

  try {
    const id = await withExponentialBackoff(async () => {
      const ref = await addDoc(collection(db, COLLECTION), {
        ...data,
        points: typeof data.points === "number" ? data.points : 0,
        isActive: data.isActive !== false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    });
    return id;
  } catch (error) {
    logError(error, {
      where: "insiders.create",
      payload: { name: data.name, membershipType: data.membershipType },
    });
    throw new AppError("Failed to create insider member", {
      code: "insiders_create_failed",
      cause: error,
    });
  }
}

export async function updateInsider(id, patch = {}) {
  if (!id) {
    throw new AppError("Missing insider member id", {
      code: "insiders_missing_id",
    });
  }
  const data = sanitize(patch);
  if (Object.keys(data).length === 0) {
    return true;
  }

  try {
    await withExponentialBackoff(async () => {
      await updateDoc(doc(db, COLLECTION, id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    });
    return true;
  } catch (error) {
    logError(error, {
      where: "insiders.update",
      payload: { id },
    });
    throw new AppError("Failed to update insider member", {
      code: "insiders_update_failed",
      cause: error,
      context: { id },
    });
  }
}

export async function deleteInsider(id) {
  if (!id) {
    throw new AppError("Missing insider member id", {
      code: "insiders_missing_id",
    });
  }
  try {
    await withExponentialBackoff(async () => {
      await deleteDoc(doc(db, COLLECTION, id));
    });
    return true;
  } catch (error) {
    logError(error, {
      where: "insiders.delete",
      payload: { id },
    });
    throw new AppError("Failed to delete insider member", {
      code: "insiders_delete_failed",
      cause: error,
      context: { id },
    });
  }
}

export async function restoreInsider(snapshot = {}) {
  const { id, ...rest } = snapshot || {};
  if (!id) {
    throw new AppError("Missing insider snapshot id", {
      code: "insiders_restore_missing_id",
    });
  }
  const payload = sanitize(rest);

  try {
    await withExponentialBackoff(async () => {
      await setDoc(doc(db, COLLECTION, id), {
        ...payload,
        createdAt: rest.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return true;
  } catch (error) {
    logError(error, {
      where: "insiders.restore",
      payload: { id },
    });
    throw new AppError("Failed to restore insider member", {
      code: "insiders_restore_failed",
      cause: error,
      context: { id },
    });
  }
}

export async function setPoints(id, points) {
  if (!id) {
    throw new AppError("Missing insider member id", {
      code: "insiders_missing_id",
    });
  }
  const value = Number(points);
  const safePoints = Number.isFinite(value) && value >= 0 ? value : 0;
  try {
    await withExponentialBackoff(async () => {
      await updateDoc(doc(db, COLLECTION, id), {
        points: safePoints,
        updatedAt: serverTimestamp(),
      });
    });
    return true;
  } catch (error) {
    logError(error, {
      where: "insiders.setPoints",
      payload: { id, points: safePoints },
    });
    throw new AppError("Failed to update insider points", {
      code: "insiders_points_failed",
      cause: error,
      context: { id },
    });
  }
}
