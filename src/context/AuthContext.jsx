import React, { createContext, useContext, useEffect, useState } from "react";
import { subscribeAuth } from "../utils/listenerRegistry";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lrpUser")) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const unsub = subscribeAuth((u) => {
      setUser(u);
      if (u) {
        localStorage.setItem("lrpUser", JSON.stringify(u));
      } else {
        localStorage.removeItem("lrpUser");
      }
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
