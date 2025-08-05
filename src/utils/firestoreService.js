// src/utils/firestoreService.js
// Centralized Firestore API utilities with basic caching.
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

let driverCache = null;

/**
 * Fetch drivers from Firestore's `drivers` collection sorted alphabetically.
 * Results are cached for the session to reduce reads.
 * @param {boolean} [force=false] - bypass the cache when true
 * @returns {Promise<Array>} list of driver documents
 */
export async function getDrivers(force = false) {
  if (!force && driverCache) return driverCache;
  const q = query(collection(db, "drivers"), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  driverCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return driverCache;
}
