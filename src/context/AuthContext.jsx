import React, { createContext, useState, useEffect, useContext } from "react";
import {
  handleRedirectResult,
  subscribeAuth
} from "../services/auth";

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Process redirect login first
    handleRedirectResult().finally(() => {
      // Then subscribe to auth state
      const unsubscribe = subscribeAuth((u) => {
        setUser(u);
        setLoading(false);
      });
      return unsubscribe;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

