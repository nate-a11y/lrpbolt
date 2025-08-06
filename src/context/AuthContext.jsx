import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, logout, handleRedirectResult } from "../firebase";

const AuthContext = createContext({
  user: null,
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    handleRedirectResult()
      .catch(() => {})
      .finally(() => {
        unsub = onAuthStateChanged(auth, (u) => {
          setUser(u);
          setLoading(false);
        });
      });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
