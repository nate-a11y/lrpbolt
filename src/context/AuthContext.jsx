import React, { createContext, useContext, useEffect, useState } from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
} from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { logError } from "../utils/logError";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          navigate(currentUser ? "/rides" : "/login", { replace: true });
        });
      } catch (err) {
        logError(err, "AuthContext:setup");
      } finally {
        setLoading(false);
      }
    })();
    return () => unsubscribe();
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
