import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { db, auth as exportedAuth } from "../firebase";

export function useRole() {
  const auth = exportedAuth || getAuth();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthLoading(false);
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [auth]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); setRoleLoading(false); return; }

    const emailKey = (user.email || "").toLowerCase();
    const uidDocRef = doc(db, "userAccessByUid", user.uid);
    const emailDocRef = emailKey ? doc(db, "userAccess", emailKey) : null;

    let unsubUid = () => {};
    let unsubEmail = () => {};

    setRoleLoading(true);
    try {
      unsubUid = onSnapshot(uidDocRef, (snap) => {
        const r = snap.exists() ? (snap.data()?.access ?? null) : null;
        if (r) {
          setRole(String(r).toLowerCase());
          setRoleLoading(false);
        } else if (emailDocRef) {
          unsubEmail = onSnapshot(emailDocRef, (snap2) => {
            const r2 = snap2.exists() ? (snap2.data()?.access ?? null) : null;
            setRole(r2 ? String(r2).toLowerCase() : null);
            setRoleLoading(false);
          }, () => setRoleLoading(false));
        } else {
          setRole(null);
          setRoleLoading(false);
        }
      }, () => {
        if (emailDocRef) {
          unsubEmail = onSnapshot(emailDocRef, (snap2) => {
            const r2 = snap2.exists() ? (snap2.data()?.access ?? null) : null;
            setRole(r2 ? String(r2).toLowerCase() : null);
            setRoleLoading(false);
          }, () => setRoleLoading(false));
        } else {
          setRole(null);
          setRoleLoading(false);
        }
      });
    } catch (_) {
      setRole(null);
      setRoleLoading(false);
    }

    return () => {
      try { unsubUid(); } catch (_) {}
      try { unsubEmail(); } catch (_) {}
    };
  }, [authLoading, user?.uid, user?.email]);

  return {
    user,
    role,
    isAdmin: role === "admin",
    isDriver: role === "driver",
    loading: authLoading || roleLoading,
  };
}

export default useRole;
