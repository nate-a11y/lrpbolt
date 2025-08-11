import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

interface RoleState {
  role: string;
  isAdmin: boolean;
  isDriver: boolean;
  loading: boolean;
  user: User | null;
}

export default function useRole(): RoleState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        let r = "";
        try {
          const uidDoc = await getDoc(doc(db, "userAccessByUid", u.uid));
          if (uidDoc.exists()) {
            r = String(uidDoc.data()?.access || "");
          } else if (u.email) {
            const emailDoc = await getDoc(doc(db, "userAccess", u.email.toLowerCase()));
            if (emailDoc.exists()) {
              r = String(emailDoc.data()?.access || "");
            }
          }
        } catch {
          r = "";
        }
        setRole(r.toLowerCase());
      } else {
        setRole("");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { role, isAdmin: role === "admin", isDriver: role === "driver", loading, user };
}
