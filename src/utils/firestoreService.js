// src/utils/firestoreService.js
// Centralized Firestore API utilities with basic caching.
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

let driverCache = null;

/**
 * Fetch drivers from the `userAccess` collection sorted alphabetically.
 * Includes both users with `driver` and `admin` access roles.
 * Results are cached for the session to reduce reads.
 * @param {boolean} [force=false] - bypass the cache when true
 * @returns {Promise<Array>} list of userAccess documents
 */
export async function getDrivers(force = false) {
  if (!force && driverCache) return driverCache;
  const q = query(
    collection(db, COLLECTIONS.USER_ACCESS),
    where("access", "in", ["driver", "admin"]),
    orderBy("name", "asc"),
  );
  const snapshot = await getDocs(q);
  driverCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return driverCache;
}

export async function createUser({ email, access, name }) {
  const docId = email.toLowerCase();
  const userRef = doc(db, COLLECTIONS.USER_ACCESS, docId);
  const existing = await getDoc(userRef);
  if (existing.exists()) throw new Error("User already exists");
  await setDoc(userRef, {
    access: access.toLowerCase(),
    email: docId,
    name: name.trim(),
  });
}

export async function updateUser({ email, access, name }) {
  await updateDoc(doc(db, COLLECTIONS.USER_ACCESS, email.toLowerCase()), {
    access: access.toLowerCase(),
    name: name.trim(),
  });
}
