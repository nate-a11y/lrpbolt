import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { app } from "../utils/firebaseInit";

const AuthContext = createContext({ user: null, authLoading: true });
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  return <AuthContext.Provider value={{ user, authLoading }}>{children}</AuthContext.Provider>;
}

