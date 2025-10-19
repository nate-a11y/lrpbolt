import { createTheme } from "@mui/material/styles";

export function getTheme(mode = "dark") {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#4cbb17",
        dark: "#3a9912",
        light: "#6fdc3b",
        contrastText: "#060606",
      },
      info: { main: "#4cbb17" },
      secondary: { main: "#4cbb17" },
      background: {
        default: mode === "dark" ? "#060606" : "#f7f8fa",
        paper: mode === "dark" ? "#101010" : "#ffffff",
      },
      divider: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)",
      action: {
        active: mode === "dark" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.78)",
        hover:
          mode === "dark" ? "rgba(76,187,23,0.12)" : "rgba(76,187,23,0.08)",
        selected:
          mode === "dark" ? "rgba(76,187,23,0.18)" : "rgba(76,187,23,0.12)",
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
      MuiDataGrid: {
        styleOverrides: {
          root: { border: 0 },
          columnHeaders: { backgroundColor: "#121212" },
        },
      },
    },
  });
}
