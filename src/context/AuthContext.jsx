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
  import { logError } from "../utils/logError";

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
        logError(err, "AuthContext");
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
      // NOTE: we no longer auto-prompt here; login button will trigger prompt
    } catch (err) {
      logError(err, "AuthContext:initOneTap");
    }
    }, [handleCredentialResponse]);

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      try {
        // ensure local persistence
        await setPersistence(auth, browserLocalPersistence);

        // listen for changes
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          try {
            if (currentUser) {
              navigate("/rides", { replace: true });
            } else if (prevUserRef.current !== null) {
              initOneTap();
            }
            prevUserRef.current = currentUser;
            setUser(currentUser);
          } catch (inner) {
            logError(inner, "AuthContext:onAuthStateChanged");
          }
        });
      } catch (err) {
        logError(err, "AuthContext:setup");
      } finally {
        setLoading(false);
      }
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
