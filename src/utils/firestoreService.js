// src/utils/firestoreService.js
// Centralized Firestore API utilities with basic caching.
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebase";

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
    collection(db, "userAccess"),
    where("access", "in", ["driver", "admin"]),
    orderBy("name", "asc"),
  );
  const snapshot = await getDocs(q);
  driverCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return driverCache;
}
