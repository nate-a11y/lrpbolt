import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithCredential,
} from "firebase/auth";
import { auth } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const oneTapInitRef = useRef(false);

  const initOneTap = useCallback(() => {
    if (oneTapInitRef.current) return;
    oneTapInitRef.current = true;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!credential) return;
          try {
            const result = await signInWithCredential(
              auth,
              GoogleAuthProvider.credential(credential),
            );
            console.log("[AuthProvider] One Tap login:", result.user.email);
          } catch (err) {
            console.error("[AuthProvider] One Tap error:", err.message);
          }
        },
        auto_select: true,
        useFedCM: true,
      });
      window.google.accounts.id.prompt();
    } catch (err) {
      console.error("[AuthProvider] One Tap init failed:", err.message);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        console.log("[AuthProvider] Persistence set to local.");
      } catch (err) {
        console.error("[AuthProvider] Persistence error:", err.message);
      }

      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        console.log("[AuthProvider] Auth state:", currentUser?.email || null);
        setUser(currentUser);
        setLoading(false);
        if (!currentUser) initOneTap();
      });
    })();

    return () => unsubscribe();
  }, [initOneTap]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
