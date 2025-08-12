import { createTheme } from "@mui/material/styles";

export function getTheme(mode = "dark") {
  return createTheme({
    palette: {
      mode,
      // brand-friendly backgrounds
      background: {
        default: mode === "dark" ? "#0e0f10" : "#f7f8fa",
        paper: mode === "dark" ? "#17191b" : "#ffffff",
      },
      divider: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)",
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (t) => ({
          "html, body, #root": {
            height: "100%",
            backgroundColor: t.palette.background.default,
          },
        }),
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: "none" } },
      },
    },
  });
}

