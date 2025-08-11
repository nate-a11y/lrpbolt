// Pure JS — no TypeScript
import { useEffect, useRef, useState } from "react";
import { onSnapshot } from "firebase/firestore";

export function useFirestoreSub(makeQuery, deps) {
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState([]);
  const readyRef = useRef(false);

  useEffect(() => {
    const q = typeof makeQuery === "function" ? makeQuery() : null;
    if (!q) return; // not ready (e.g., role/auth not loaded yet)
    readyRef.current = true;

    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
      },
      (e) => setError(e)
    );

    return () => { try { unsub(); } catch (_) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { docs, error, ready: readyRef.current };
}

export default useFirestoreSub;
