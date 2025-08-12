import { useEffect, useRef, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import { useAuth } from "../context/AuthContext.jsx";

export function useFirestoreSub(makeQuery, deps) {
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState([]);
  const readyRef = useRef(false);
  const { user, authLoading } = useAuth();

  const depsWithAuth = Array.isArray(deps)
    ? [authLoading, user, ...deps]
    : [authLoading, user];

  useEffect(() => {
    if (authLoading || !user) return;
    const q = typeof makeQuery === "function" ? makeQuery() : null;
    if (!q) return;
    readyRef.current = true;

    const unsub = onSnapshot(q, (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setError(null);
    }, (e) => setError(e));

    return () => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, depsWithAuth);

  return { docs, error, ready: readyRef.current };
}

export default useFirestoreSub;
