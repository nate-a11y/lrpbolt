import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { logout as authLogout } from "../services/auth";

const DriverContext = createContext(null);

export const DriverProvider = ({ children }) => {
  const [driver, setDriverState] = useState(() => {
    const stored = localStorage.getItem("lrpDriver");
    return stored ? JSON.parse(stored) : null;
  });

  const setDriver = useCallback(async (data) => {
    if (data) {
      localStorage.setItem("lrpDriver", JSON.stringify(data));
    } else {
      localStorage.removeItem("lrpDriver");
    }
    setDriverState(data);
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setDriver(null);
  }, [setDriver]);

  const value = useMemo(
    () => ({ driver, setDriver, logout }),
    [driver, setDriver, logout],
  );

  return (
    <DriverContext.Provider value={value}>{children}</DriverContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDriver = () => useContext(DriverContext);
