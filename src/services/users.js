import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import AppError from "src/utils/AppError.js";
import { db } from "src/utils/firebaseInit";
import logError from "src/utils/logError.js";
import retry from "src/utils/retry.js";

/** Normalizes a userAccess document into { id, email, name, phone, roles:[] } */
export async function fetchAllUsersAccess() {
  try {
    const snap = await getDocs(collection(db, "userAccess"));
    const out = [];
    snap.forEach((d) => {
      const val = d.data() || {};
      const email = (val.email || d.id || "").toLowerCase();
      const roles = Array.isArray(val.roles)
        ? val.roles.map(String).map((r) => r.toLowerCase())
        : Array.isArray(val.access)
          ? val.access.map(String).map((r) => r.toLowerCase())
          : typeof val.access === "string"
            ? [val.access.toLowerCase()]
            : val.role
              ? [String(val.role).toLowerCase()]
              : [];
      out.push({
        id: email || d.id,
        email,
        name: val.name || "",
        phone: val.phone || "",
        roles,
      });
    });
    return out;
  } catch (err) {
    logError(err, { where: "users", action: "fetchAllUsersAccess" });
    return [];
  }
}

/** Helpers to filter by role */
export function filterAdmins(users) {
  return users.filter((u) => u.roles?.includes("admin"));
}
export function filterDriversCore(users) {
  // 'core' drivers who have 'driver' but NOT 'shootout' only
  return users.filter(
    (u) => u.roles?.includes("driver") && !u.roles?.includes("shootout"),
  );
}
export function filterShootout(users) {
  return users.filter((u) => u.roles?.includes("shootout"));
}
export function filterDriversCombined(users) {
  // union of driver and shootout roles (no duplicates)
  const seen = new Set();
  const out = [];
  users.forEach((u) => {
    if (u.roles?.includes("driver") || u.roles?.includes("shootout")) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        out.push(u);
      }
    }
  });
  return out;
}

export async function saveUserPhoneNumber(email, phone) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const normalizedPhone = (phone || "").trim();

  if (!normalizedEmail) {
    throw new AppError("Email is required", "SAVE_PHONE_EMAIL");
  }
  if (!normalizedPhone) {
    throw new AppError("Phone number is required", "SAVE_PHONE_VALUE", {
      email: normalizedEmail,
    });
  }

  const ref = doc(db, "userAccess", normalizedEmail);

  try {
    await retry(
      async () =>
        setDoc(
          ref,
          {
            email: normalizedEmail,
            phone: normalizedPhone,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        ),
      {
        tries: 3,
        onError: (err, attempt) =>
          logError(err, {
            where: "users",
            action: "saveUserPhoneNumber",
            attempt,
            email: normalizedEmail,
          }),
      },
    );
    return { success: true };
  } catch (err) {
    const appErr =
      err instanceof AppError
        ? err
        : new AppError(
            err?.message || "Failed to save phone number",
            "FIRESTORE_UPDATE",
            { email: normalizedEmail },
          );
    logError(appErr, {
      where: "users",
      action: "saveUserPhoneNumber",
      email: normalizedEmail,
    });
    throw appErr;
  }
}

export async function getUserContacts(userId) {
  const contact = {
    email: null,
    phone: null,
    displayName: null,
    fcmTokens: [],
  };

  if (!userId) {
    return contact;
  }

  const tried = new Set();
  const paths = [
    ["users", userId],
    ["userAccess", userId],
  ];

  try {
    for (const path of paths) {
      const key = path.join("/");
      if (tried.has(key)) continue;
      tried.add(key);

      const snapshot = await getDoc(doc(db, ...path));
      if (!snapshot.exists()) {
        continue;
      }
      const data = snapshot.data() || {};
      contact.displayName =
        contact.displayName || data.name || data.displayName || null;
      contact.email = contact.email || data.email || null;
      contact.phone = contact.phone || data.phone || data.phoneNumber || null;
    }

    const fcmSnapshot = await getDocs(collection(db, "fcmTokens"));
    fcmSnapshot.forEach((tokenDoc) => {
      const data = tokenDoc.data() || {};
      if (!data.email || !contact.email) return;
      if (
        String(data.email).toLowerCase() !== String(contact.email).toLowerCase()
      ) {
        return;
      }
      if (!data.source) {
        return;
      }
      contact.fcmTokens.push(tokenDoc.id);
    });
  } catch (err) {
    logError(err, { where: "users.getUserContacts", userId });
  }

  return contact;
}
