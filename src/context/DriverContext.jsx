import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, auth, signOut } from "../firebase";
import { getUserAccess } from "../hooks/api";

const DriverContext = createContext(null);

export const DriverProvider = ({ children }) => {
  const [driver, setDriverState] = useState(() => {
    const stored = localStorage.getItem("lrpDriver");
    return stored ? JSON.parse(stored) : null;
  });

  const setDriver = (data) => {
    if (data) {
      localStorage.setItem("lrpDriver", JSON.stringify(data));
    } else {
      localStorage.removeItem("lrpDriver");
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

  const login = async (firebaseUser) => {
    const data = await getUserAccess(firebaseUser.email);
    if (!data) throw new Error("Access denied");
    const access = data.access?.toLowerCase() === "admin" ? "Admin" : "Driver";
    setDriver({ id: data.id, name: data.name, email: firebaseUser.email, access });
  };

  return (
    <DriverContext.Provider value={{ driver, setDriver, login, logout }}>
      {children}
    </DriverContext.Provider>
  );
};

export const useDriver = () => useContext(DriverContext);
