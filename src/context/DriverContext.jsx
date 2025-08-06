import React, { createContext, useContext, useState } from "react";
import { logout as authLogout } from "../services/auth";

const DriverContext = createContext(null);

export const DriverProvider = ({ children }) => {
  const [driver, setDriverState] = useState(() => {
    const stored = localStorage.getItem("lrpDriver");
    return stored ? JSON.parse(stored) : null;
  });

  const setDriver = async (data) => {
    if (data) {
      localStorage.setItem("lrpDriver", JSON.stringify(data));
    } else {
      localStorage.removeItem("lrpDriver");
    }
    setDriverState(data);
  };

  const logout = async () => {
    await authLogout();
    setDriver(null);
  };

  return (
    <DriverContext.Provider value={{ driver, setDriver, logout }}>
      {children}
    </DriverContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDriver = () => useContext(DriverContext);

