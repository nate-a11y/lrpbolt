import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { useAuth } from "../context/AuthContext.jsx";
import { db } from "src/utils/firebaseInit";

export function useRole() {
  const { user, authLoading } = useAuth();
  const [role, setRole] = useState("");

  useEffect(() => {
    if (authLoading || !user?.email) return;
    const id = user.email.toLowerCase();
    const ref = doc(db, "userAccess", id);
    const unsub = onSnapshot(ref, (snap) => {
      setRole(String(snap.data()?.access || "").toLowerCase());
    }, () => setRole(""));
    return () => unsub?.();
  }, [authLoading, user?.email]);

  return { role, authLoading };
}
