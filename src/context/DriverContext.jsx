import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, auth, signOut, db } from "../firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";

const DriverContext = createContext(null);

export const DriverProvider = ({ children }) => {
  const [driver, setDriverState] = useState(() => {
    const stored = localStorage.getItem("lrpDriver");
    return stored ? JSON.parse(stored) : null;
  });

  const setDriver = async (data) => {
    if (data) {
      localStorage.setItem("lrpDriver", JSON.stringify(data));
      if (import.meta.env.DEV) console.log("Current driver:", data.name);
      try {
        await updateDoc(doc(db, "userAccess", data.id), {
          lastActive: Timestamp.now(),
        });
      } catch (err) {
        if (import.meta.env.DEV) console.error("Failed to persist driver", err);
      }
    } else {
      localStorage.removeItem("lrpDriver");
      if (import.meta.env.DEV) console.log("Driver cleared");
    }
    setDriverState(data);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setDriver(null);
      }
    });
    return () => unsub();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setDriver(null);
  };

  return (
    <DriverContext.Provider value={{ driver, setDriver, logout }}>
      {children}
    </DriverContext.Provider>
  );
};

export const useDriver = () => useContext(DriverContext);
