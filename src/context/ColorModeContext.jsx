import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { ThemeProvider, CssBaseline, GlobalStyles } from "@mui/material";
import { buildTheme, getInitialMode, STORAGE_KEY } from "../theme";

const ColorModeContext = createContext({ mode: "dark", setMode: () => {}, toggle: () => {} });
export const useColorMode = () => useContext(ColorModeContext);

export default function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(getInitialMode());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#060606");
    document.body.dataset.theme = mode;
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode, toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")) }), [mode]);
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={{ "::selection": { background: "rgba(76,187,23,0.35)" } }} />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
