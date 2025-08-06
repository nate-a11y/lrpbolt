// src/hooks/useAuthGuard.js
// Simple authentication guard to ensure user is logged in and optionally has a role
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
} from "firebase/auth";
import { auth } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log("[AuthProvider] Initializing auth listener...");

    let unsubscribe = () => {};

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("[AuthProvider] Persistence set to local.");

        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          if (currentUser) {
            console.log(`[AuthProvider] Authenticated as: ${currentUser.email}`);
          } else {
            console.log("[AuthProvider] No user signed in.");
          }
          setUser(currentUser);
          setLoading(false); // ✅ Prevent redirect until auth resolves
        });
      })
      .catch((err) => {
        console.error("[AuthProvider] Persistence error:", err.message);
        setLoading(false);
      });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
