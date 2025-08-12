import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "src/utils/firebaseInit";

import { useAuth } from "../context/AuthContext.jsx";

/**
 * Subscribes to a Firestore collection and returns real-time data.
 *
 * React re-renders recreate the `qConstraints` array, which previously caused
 * this hook to tear down and reattach the snapshot listener on every update.
 * That led to a "runaway" listener on the /rides page. By memoizing the
 * constraints with a stable key, we ensure the subscription only refreshes when
 * the actual constraint values change.
 */
export default function useFirestoreListener(path, qConstraints = []) {
  const [data, setData] = useState([]);
  // Generate a stable key for the constraints to avoid unnecessary re-subscribes
  const constraintKey = useMemo(() => JSON.stringify(qConstraints), [qConstraints]);
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;
    const colRef = collection(db, path);
    const q = query(colRef, ...qConstraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, path, constraintKey]);

  return data;
}
