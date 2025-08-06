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

  const handleCredentialResponse = useCallback(async ({ credential }) => {
    if (!credential) return;
    try {
      const result = await signInWithCredential(
        auth,
        GoogleAuthProvider.credential(credential),
      );
      console.log("[AuthProvider] One Tap login:", result.user.email);
    } catch (err) {
      console.error(
        "[AuthProvider] One Tap error:",
        err?.message || JSON.stringify(err),
      );
    }
  }, []);

  const initOneTap = useCallback(() => {
    if (oneTapInitRef.current) return;
    oneTapInitRef.current = true;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: true,
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.prompt();
    } catch (err) {
      console.error(
        "[AuthProvider] One Tap init failed:",
        err?.message || JSON.stringify(err),
      );
    }
  }, [handleCredentialResponse]);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (err) {
        console.error(
          "[AuthProvider] Persistence error:",
          err?.message || JSON.stringify(err),
        );
      }

      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        console.log(
          "[AuthProvider] Auth state:",
          currentUser?.email || "No user",
        );
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
