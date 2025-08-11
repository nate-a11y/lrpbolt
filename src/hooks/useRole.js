// Pure JS — no TypeScript
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";                  // adjust if your firebase export lives elsewhere
import { useAuth } from "../context/AuthContext";  // must expose { user, authLoading }

export function useRole() {
  const { user, authLoading } = useAuth();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait until auth settles
    if (authLoading) return;
    if (!user) { setRole(null); setLoading(false); return; }

    const emailKey = (user.email || "").toLowerCase();
    const uidDoc = doc(db, "userAccessByUid", user.uid);
    const emailDoc = emailKey ? doc(db, "userAccess", emailKey) : null;

    let unsubUid = () => {};
    let unsubEmail = () => {};

    try {
      unsubUid = onSnapshot(
        uidDoc,
        (snap) => {
          const r = snap.exists() ? (snap.data()?.access ?? null) : null;
          if (r) {
            setRole(String(r).toLowerCase());
            setLoading(false);
          } else if (emailDoc) {
            unsubEmail = onSnapshot(
              emailDoc,
              (snap2) => {
                const r2 = snap2.exists() ? (snap2.data()?.access ?? null) : null;
                setRole(r2 ? String(r2).toLowerCase() : null);
                setLoading(false);
              },
              () => setLoading(false)
            );
          } else {
            setRole(null);
            setLoading(false);
          }
        },
        () => {
          // UID lookup errored; try email as fallback
          if (emailDoc) {
            unsubEmail = onSnapshot(
              emailDoc,
              (snap2) => {
                const r2 = snap2.exists() ? (snap2.data()?.access ?? null) : null;
                setRole(r2 ? String(r2).toLowerCase() : null);
                setLoading(false);
              },
              () => setLoading(false)
            );
          } else {
            setRole(null);
            setLoading(false);
          }
        }
      );
    } catch (e) {
      setRole(null);
      setLoading(false);
    }

    return () => {
      try { unsubUid(); } catch (_) {}
      try { unsubEmail(); } catch (_) {}
    };
  }, [authLoading, user?.uid, user?.email]);

  return {
    role,
    isAdmin: role === "admin",
    isDriver: role === "driver",
    loading: !!(authLoading || loading),
    user,
  };
}

export default useRole;
