import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";

import { db } from "src/utils/firebaseInit";

import { useAuth } from "../context/AuthContext.jsx";
import { nullifyMissing } from "../utils/formatters.js";

export default function useFirestoreListener(path, qConstraints = []) {
  const [data, setData] = useState([]);
  const constraints = useMemo(() => qConstraints, [qConstraints]);
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;
    const colRef = collection(db, path);
    const q = query(colRef, ...constraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setData(
        snapshot.docs.map((doc) => {
          const data = doc.data() || {};
          return { id: doc.id, ...nullifyMissing(data) };
        }),
      );
    });
    return () => unsubscribe();
  }, [authLoading, user, path, constraints]);

  return data;
}
