import { useEffect, useState } from "react";
import { onSnapshot, Query, DocumentData } from "firebase/firestore";

export default function useFirestoreSub(
  makeQuery: () => Query<DocumentData> | null | undefined,
  deps: any[] = [],
) {
  const [data, setData] = useState<DocumentData[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = makeQuery();
    if (!q) return;
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError(null);
      },
      (err) => setError(err),
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error };
}
