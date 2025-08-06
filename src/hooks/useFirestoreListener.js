import { useState, useEffect, useMemo } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function useFirestoreListener(path, qConstraints = []) {
  const [data, setData] = useState([]);
  const constraints = useMemo(() => qConstraints, [qConstraints]);

  useEffect(() => {
    const colRef = collection(db, path);
    const q = query(colRef, ...constraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [path, constraints]);

  return data;
}
