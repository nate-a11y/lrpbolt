/* Proprietary and confidential. See LICENSE. */
import { useEffect } from "react";
import usePersistentState from "./usePersistentState";

export default function useDarkMode() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [darkMode, setDarkMode] = usePersistentState(
    "lrp_darkMode",
    prefersDark,
  );

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return [darkMode, setDarkMode];
}
