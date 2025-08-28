import { createTheme } from "@mui/material/styles";

export function getTheme(mode = "dark") {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#2ecc71",
        dark: "#27ae60",
        light: "#58d68d",
        contrastText: "#0a0a0a",
      },
      info: { main: "#2ecc71" },
      secondary: { main: "#2ecc71" },
      background: {
        default: mode === "dark" ? "#0e0f10" : "#f7f8fa",
        paper: mode === "dark" ? "#17191b" : "#ffffff",
      },
      divider: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)",
      action: {
        active: mode === "dark" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.78)",
        hover: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        selected:
          mode === "dark" ? "rgba(46,204,113,0.18)" : "rgba(46,204,113,0.12)",
      },
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
      MuiLink: {
        styleOverrides: {
          root: ({ theme: t }) => ({ color: t.palette.primary.main }),
        },
      },
      MuiButton: {
        styleOverrides: {
          containedPrimary: () => ({ boxShadow: "none" }),
          outlinedInfo: ({ theme: t }) => ({
            borderColor: t.palette.primary.main,
            color: t.palette.primary.main,
          }),
          outlinedSecondary: ({ theme: t }) => ({
            borderColor: t.palette.primary.main,
            color: t.palette.primary.main,
          }),
        },
      },
    },
  });
}
