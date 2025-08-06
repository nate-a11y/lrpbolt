import React, { useState, useEffect, useMemo } from "react";
import { handleRedirectResult, subscribeAuth } from "../services/auth";
import { AuthContext } from "./AuthContext.js";

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

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
