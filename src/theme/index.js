/* Proprietary and confidential. See LICENSE. */
import { createTheme, responsiveFontSizes, alpha } from "@mui/material/styles";

const LRP_GREEN = "#4cbb17";
const LRP_BLACK = "#060606";

export const brand = {
  green500: LRP_GREEN,
  green400: "#60e421",
  green700: "#3a8e11",
  black: LRP_BLACK,
  white: "#ffffff",
  grey200: "#e6e6e6",
};

/**
 * Return palette + tokens based on color mode.
 * We keep all app-specific color choices, but derive surfaces,
 * text, divider, and alphas from the active mode.
 */
function getDesignTokens(mode = "dark") {
  const isDark = mode === "dark";

  const basePalette = {
    mode,
    primary: {
      main: LRP_GREEN,
      dark: brand.green700,
      light: brand.green400,
      contrastText: isDark ? brand.black : brand.black, // Green works with black in both modes for brand consistency
    },
    success: {
      main: brand.green500,
      dark: brand.green700,
      light: brand.green400,
    },
    warning: { main: "#f9a825" },
    error: { main: "#ef5350" },
    info: { main: "#64b5f6" },
    brand,
    background: {
      default: isDark ? LRP_BLACK : "#f7f8fa",
      paper: isDark ? "#0b0b0b" : "#ffffff",
    },
    text: {
      primary: isDark ? "#ffffff" : "#111111",
      secondary: isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.68)",
      disabled: alpha(isDark ? "#ffffff" : "#111111", 0.38),
    },
    divider: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
    action: {
      active: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.78)",
      hover: alpha(LRP_GREEN, isDark ? 0.12 : 0.08),
      selected: alpha(LRP_GREEN, isDark ? 0.18 : 0.12),
      disabled: alpha(isDark ? "#ffffff" : "#000000", 0.38),
      disabledBackground: alpha(isDark ? "#ffffff" : "#000000", 0.12),
      focus: alpha(LRP_GREEN, 0.35),
    },
  };

  const getFocusOutline = (color) => `2px solid ${color}`;

  return {
    palette: basePalette,
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      h1: { fontWeight: 800 },
      h2: { fontWeight: 800 },
      h3: { fontWeight: 800 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shadows: [
      "none",
      ...new Array(24)
        .fill(0)
        .map((_, i) =>
          isDark
            ? `0 ${Math.min(1 + i, 24)}px ${Math.min(3 + 2 * i, 64)}px rgba(0,0,0,0.35)`
            : `0 ${Math.min(1 + i, 24)}px ${Math.min(3 + 2 * i, 64)}px rgba(0,0,0,0.10)`,
        ),
    ],
    transitions: {
      duration: {
        shortest: 120,
        shorter: 160,
        short: 200,
        standard: 200,
        complex: 250,
        enteringScreen: 220,
        leavingScreen: 180,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "html, body, #root": { height: "100%" },
          body: ({ theme }) => ({
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            transition: "background-color 0.3s ease, color 0.3s ease",
          }),
          a: ({ theme }) => ({ color: theme.palette.primary.main }),
          "@media (prefers-reduced-motion: reduce)": {
            "*, *::before, *::after": {
              animationDuration: "0.001ms !important",
              animationIterationCount: "1 !important",
              transitionDuration: "0.001ms !important",
            },
            html: { scrollBehavior: "auto !important" },
          },
        },
      },

      MuiLink: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.primary.main,
            fontWeight: 600,
            "&:focus-visible": {
              outline: getFocusOutline(theme.palette.primary.main),
              outlineOffset: 2,
            },
          }),
        },
      },

      MuiButtonBase: {
        defaultProps: { disableRipple: false, disableTouchRipple: false },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.shape.borderRadius,
            textTransform: "none",
            fontWeight: 600,
            "&:focus-visible": {
              outline: getFocusOutline(LRP_GREEN),
              outlineOffset: 2,
            },
          }),
          containedPrimary: ({ theme }) => ({
            backgroundColor: theme.palette.primary.main,
            "&:hover": { backgroundColor: theme.palette.primary.dark },
            "&:active": {
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}`,
            },
            "&:focus-visible": {
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.35)}`,
            },
            boxShadow: isDark
              ? "0 6px 18px rgba(76,187,23,0.28)"
              : "0 6px 18px rgba(76,187,23,0.18)",
          }),
          outlinedPrimary: ({ theme }) => ({
            borderColor: alpha(theme.palette.primary.main, 0.6),
            "&:hover": {
              borderColor: theme.palette.primary.main,
              background: alpha(
                theme.palette.primary.main,
                isDark ? 0.08 : 0.06,
              ),
            },
          }),
        },
      },

      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
            boxShadow: isDark
              ? "0 10px 35px rgba(0,0,0,0.45)"
              : "0 10px 35px rgba(0,0,0,0.08)",
          }),
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
          }),
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backdropFilter: "saturate(180%) blur(8px)",
            WebkitBackdropFilter: "saturate(180%) blur(8px)",
            backgroundColor: alpha(
              theme.palette.background.paper,
              isDark ? 0.9 : 0.85,
            ),
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },

      MuiTextField: {
        defaultProps: { variant: "outlined", fullWidth: true },
      },

      MuiDataGrid: {
        defaultProps: { density: "compact" },
        styleOverrides: {
          root: ({ theme }) => ({
            border: 0,
            borderRadius: theme.shape.borderRadius,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            "--DataGrid-rowBorderColor": theme.palette.divider,
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: alpha(
                theme.palette.primary.main,
                isDark ? 0.08 : 0.06,
              ),
              borderBottom: `1px solid ${theme.palette.divider}`,
            },
            "& .MuiDataGrid-footerContainer": {
              borderTop: `1px solid ${theme.palette.divider}`,
              backgroundColor: alpha(
                theme.palette.primary.main,
                isDark ? 0.04 : 0.03,
              ),
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: alpha(
                theme.palette.primary.main,
                isDark ? 0.12 : 0.08,
              ),
            },
            "& .MuiCheckbox-root.Mui-checked": {
              color: theme.palette.primary.main,
            },
            "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
              outline: `1px solid ${theme.palette.primary.main}`,
              outlineOffset: -1,
            },
            "& .MuiDataGrid-columnHeader:focus-within": { outline: "none" },
          }),
          cell: { outline: "none !important" },
          columnHeaders: {
            borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
          },
        },
      },
    },
  };
}

export const buildTheme = (mode = "dark") =>
  responsiveFontSizes(createTheme(getDesignTokens(mode)));
