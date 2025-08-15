/* Proprietary and confidential. See LICENSE. */
// src/hooks/useUserAccessDrivers.js
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";

import { db } from "../utils/firebaseInit";

/**
 * Live drivers list from Firestore userAccess.
 * Returns { drivers, loading, error }
 * drivers: [{ id: email, name, email, access }]
 */
export function useUserAccessDrivers(roles = ["admin", "driver"]) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);

    const q = query(
      collection(db, "userAccess"),
      where("access", "in", roles),
      limit(1000)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => {
            const x = d.data() ?? {};
            const email = (x.email || d.id || "").trim();
            const name =
              (x.name || "").toString().trim() ||
              (email.includes("@") ? email.split("@")[0] : email) ||
              "Unknown";
            return {
              id: email, // use email as stable id
              email,
              name,
              access: (x.access || "").toString().toLowerCase(),
            };
          })
          .filter(Boolean);
        setRows(data);
        setLoading(false);
      },
      (err) => {
        console.error("[useUserAccessDrivers] onSnapshot error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
    // NOTE: roles must be in deps to satisfy eslint
  }, [roles]);

  const drivers = useMemo(() => {
    const map = new Map();
    for (const r of rows) if (r.id) map.set(r.id, r);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  return { drivers, loading, error };
}
