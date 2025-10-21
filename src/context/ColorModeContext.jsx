import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";

import getTheme from "../theme";

const ColorModeContext = createContext({ mode: "dark", toggle: () => {} });
export const useColorMode = () => useContext(ColorModeContext);

const prefersDark = () => {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const readStoredMode = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("lrp-mode");
  } catch {
    return null;
  }
};

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const stored = readStoredMode();
    if (stored === "light" || stored === "dark") return stored;
    return prefersDark() ? "dark" : "light";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("lrp-mode", mode);
    } catch {
      /* ignore persistence issues */
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-color-mode", mode);
    }
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      const stored = readStoredMode();
      if (stored === "light" || stored === "dark") return;
      setMode(event.matches ? "dark" : "light");
    };
    media.addEventListener?.("change", handleChange);
    if (!media.addEventListener) {
      media.addListener(handleChange);
      return () => media.removeListener(handleChange);
    }
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
    }),
    [mode],
  );

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

export default ColorModeContext;
