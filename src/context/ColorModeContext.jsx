import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider, CssBaseline, useMediaQuery } from "@mui/material";
import { getTheme } from "../theme/getTheme";

const ColorModeContext = createContext({ mode: "dark", toggle: () => {}, set: () => {} });
export const useColorMode = () => useContext(ColorModeContext);

export function ColorModeProvider({ children }) {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem("lrp:themeMode");
    return saved === "light" || saved === "dark" ? saved : (prefersDark ? "dark" : "light");
  });
  useEffect(() => { localStorage.setItem("lrp:themeMode", mode); }, [mode]);

  const value = useMemo(() => ({
    mode,
    toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
    set: (m) => setMode(m === "light" ? "light" : "dark"),
  }), [mode]);

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
