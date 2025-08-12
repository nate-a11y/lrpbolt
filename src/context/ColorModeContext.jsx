import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { buildTheme } from "../theme";

export const ColorModeContext = createContext({ mode: "dark", toggle: () => {} });

export default function ColorModeProvider({ children }) {
  const systemPrefersDark = typeof window !== "undefined" &&
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  const [mode, setMode] = useState(() => localStorage.getItem("lrp:mode") || (systemPrefersDark ? "dark" : "light"));

  useEffect(() => { localStorage.setItem("lrp:mode", mode); }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === "light" ? "dark" : "light")), []);
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
