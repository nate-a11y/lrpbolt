import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth } from "../firebase";
import LoadingScreen from "../components/LoadingScreen.jsx";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setPersistence(auth, browserLocalPersistence).catch((err) =>
      console.error("Failed to set auth persistence", err),
    );
    const unsub = onAuthStateChanged(auth, (u) => {
      if (import.meta.env.DEV) {
        console.log(
          "🔐 Auth state",
          u ? `${u.email} (${u.uid})` : "signed out",
        );
      }
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <LoadingScreen />;
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
