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
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const oneTapInitRef = useRef(false);
  const prevUserRef = useRef(undefined);
  const navigate = useNavigate();

  const handleCredentialResponse = useCallback(async ({ credential }) => {
    if (!credential) return;
    try {
      const firebaseCredential = GoogleAuthProvider.credential(credential);
      const result = await signInWithCredential(auth, firebaseCredential);
      console.log(`Authenticated as: ${result.user?.email}`);
      navigate("/rides", { replace: true });
    } catch (err) {
      console.error(err?.message || JSON.stringify(err));
    }
  }, [navigate]);

  const initOneTap = useCallback(() => {
    if (oneTapInitRef.current) return;
    oneTapInitRef.current = true;

    if (!window.google?.accounts?.id) return;
    try {
      window.google.accounts.id.initialize({
        client_id:
          "799613895072-obt66rah27n1saqfodrflt0memgn3k6p.apps.googleusercontent.com",
        callback: handleCredentialResponse,
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.prompt();
    } catch (err) {
      console.error(err?.message || JSON.stringify(err));
    }
  }, [handleCredentialResponse]);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (err) {
        console.error(err?.message || JSON.stringify(err));
      }

      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
          if (prevUserRef.current?.email !== currentUser.email)
            console.log(`Authenticated as: ${currentUser.email}`);
          navigate("/rides", { replace: true });
        } else if (prevUserRef.current !== null) {
          console.log("No user");
          initOneTap();
        }
        prevUserRef.current = currentUser;
        setUser(currentUser);
        setLoading(false);
      });
    })();

    return () => unsubscribe();
  }, [initOneTap, navigate]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
