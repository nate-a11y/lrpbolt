import { IconButton, Tooltip } from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

import { useColorMode } from "../context/ColorModeContext.jsx";

export default function ThemeToggle() {
  const { mode, toggle } = useColorMode();
  return (
    <Tooltip
      title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <IconButton aria-label="Toggle theme" onClick={toggle} size="small">
        {mode === "dark" ? (
          <LightModeIcon fontSize="small" />
        ) : (
          <DarkModeIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}
