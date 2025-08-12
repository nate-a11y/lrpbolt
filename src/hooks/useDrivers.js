import { useState } from "react";
import { collection } from "firebase/firestore";
import { db } from "../utils/firebaseInit";
import useFirestoreSub from "./useFirestoreSub";

export function useDrivers() {
  const [drivers, setDrivers] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  useFirestoreSub(
    "drivers:all",
    () => collection(db, "drivers"),
    (snap) => { setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
    (e) => { setError(e); setLoading(false); },
    []
  );
  return { drivers, loading, error };
}
