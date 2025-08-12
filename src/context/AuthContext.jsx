/* Proprietary and confidential. See LICENSE. */
import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { auth } from "../utils/firebaseInit";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { killAllListeners } from "../utils/firestoreListenerRegistry";

const AuthContext = createContext({ user: null, authLoading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      try {
        killAllListeners();
      } catch (e) {
        void e;
      }
    }
  }, [user]);

  useEffect(() => {
    let timer = null;
    const onVis = () => {
      if (document.hidden) {
        timer = setTimeout(() => {
          try {
            killAllListeners();
          } catch (e) {
            void e;
          }
        }, 120000);
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const signIn = async (email, password, remember = true) => {
    try {
      if (remember) {
        await setPersistence(auth, browserLocalPersistence);
      }
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      throw e;
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      throw e;
    }
  };

  const sendPasswordReset = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      throw e;
    }
  };

  const value = useMemo(
    () => ({ user, authLoading, signIn, signOut, sendPasswordReset }),
    [user, authLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

