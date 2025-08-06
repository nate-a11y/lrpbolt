import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

const AuthContext = createContext(null);
const auth = getAuth();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    getRedirectResult(auth).catch(console.error);
  }, []);

  const loginWithPopup = () =>
    signInWithPopup(auth, new GoogleAuthProvider());

  const loginWithRedirect = () =>
    signInWithRedirect(auth, new GoogleAuthProvider());

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider
      value={{ user, loading, loginWithPopup, loginWithRedirect, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
