/* Proprietary and confidential. See LICENSE. */
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useContext,
} from "react";
import { ThemeProvider, CssBaseline, useMediaQuery } from "@mui/material";
import { buildTheme } from "../theme";

export const ColorModeContext = createContext({ mode: "dark", toggle: () => {} });
export const useColorMode = () => useContext(ColorModeContext);

export default function ColorModeProvider({ children }) {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", { defaultMatches: true });

  const [mode, setMode] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("lrp:mode") || (prefersDark ? "dark" : "light");
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("lrp:mode", mode);
    }
  }, [mode]);

  // Optional: react to OS changes only if user never manually toggled
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      const stored = localStorage.getItem("lrp:mode");
      if (!stored) setMode(e.matches ? "dark" : "light");
    };
    // modern addEventListener with fallback
    try {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    } catch (_err) {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, []);

  const toggle = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

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
