import { useState } from "react";
import { collection, query } from "firebase/firestore";

import { useAuth } from "../context/AuthContext.jsx";
import { db } from "../utils/firebaseInit";
import useFirestoreSub from "./useFirestoreSub";

export default function useFirestoreListener(path, qConstraints = []) {
  const [data, setData] = useState([]);
  const { user, authLoading } = useAuth();
  useFirestoreSub(
    `listener:${path}`,
    () => {
      if (authLoading || !user) return null;
      const colRef = collection(db, path);
      return qConstraints.length ? query(colRef, ...qConstraints) : colRef;
    },
    (snap) => setData(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
    undefined,
    [authLoading, user, path, ...qConstraints]
  );
  return data;
}
