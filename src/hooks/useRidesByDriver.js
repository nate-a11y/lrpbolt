import { useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "../utils/firebaseInit";
import useFirestoreSub from "./useFirestoreSub";

export function useRidesByDriver(driverId, serviceDate) {
  const [data, setData] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  useFirestoreSub(
    `rides:driver=${driverId}|date=${serviceDate ?? "all"}`,
    () => {
      if (!driverId) return null;
      const col = collection(db, "rides");
      return serviceDate ? query(col, where("driverId","==",driverId), where("serviceDate","==",serviceDate))
                        : query(col, where("driverId","==",driverId));
    },
    (snap) => { setData(snap.docs.map(d => ({ id:d.id, ...d.data() }))); setLoading(false); },
    (e) => { setError(e); setLoading(false); },
    [driverId, serviceDate]
  );
  return { data, loading, error };
}
