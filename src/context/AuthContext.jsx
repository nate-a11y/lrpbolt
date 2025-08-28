import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

import { app, db } from "../utils/firebaseInit";

const AuthContext = createContext({
  user: null,
  role: "driver",
  authLoading: true,
  roleLoading: true,
});
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState("driver");
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setUser(u || null);
        setAuthLoading(false);
      },
      () => setAuthLoading(false),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authLoading || !user) {
      setRole("driver");
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        let r = snap.data()?.role;
        if (!r) {
          try {
            const legacy = await getDoc(
              doc(db, "userAccess", user.email.toLowerCase()),
            );
            r = legacy.data()?.access;
          } catch {
            r = null;
          }
        }
        setRole(String(r || "driver").toLowerCase());
        setRoleLoading(false);
      },
      () => {
        setRole("driver");
        setRoleLoading(false);
      },
    );
    return () => unsub();
  }, [authLoading, user]);

  const value = useMemo(
    () => ({ user, role, authLoading, roleLoading }),
    [user, role, authLoading, roleLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
