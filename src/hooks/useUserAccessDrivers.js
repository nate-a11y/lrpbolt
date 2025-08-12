/* Proprietary and confidential. See LICENSE. */
// src/hooks/useUserAccessDrivers.js
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { db } from "../firebase"; // or wherever you export Firestore

/**
 * Live drivers list from Firestore userAccess.
 * Each item: { id: email, name, email, access }
 */
export function useUserAccessDrivers(roles = ["admin", "driver"]) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    // Firestore: where 'access' in ['admin','driver']
    // Avoid orderBy here to prevent composite-index headaches; we’ll sort client-side.
    const q = query(
      collection(db, "userAccess"),
      where("access", "in", roles),
      limit(1000)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => {
          const docData = d.data() ?? {};
          const email = (docData.email || d.id || "").trim();
          // Fallback name from email if missing
          const name =
            (docData.name || "")
              .toString()
              .trim() || email.split("@")[0] || "Unknown";

        return {
            id: email,             // use email as stable id
            email,
            name,
            access: (docData.access || "").toString().toLowerCase(),
          };
        });
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
  }, [roles.join("|")]);

  // Sort by name and dedupe by id
  const drivers = useMemo(() => {
    const map = new Map();
    for (const r of rows) if (r.id) map.set(r.id, r);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  return { drivers, loading, error };
}
