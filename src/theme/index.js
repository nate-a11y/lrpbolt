/* Proprietary and confidential. See LICENSE. */
import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";

export const STORAGE_KEY = "lrp:color-mode";
export const brand = {
  green500: "#4cbb17",
  green400: "#60e421",
  green700: "#3a8e11",
  black: "#060606",
    white: "#FFFFFF",
  grey200: "#e6e6e6",
};

export function getInitialMode() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "dark" || s === "light") return s;
  } catch (e) { void e; }
  return "dark";
}

const base = {
  shape: { borderRadius: 12 },
  typography: {
    button: { textTransform: "none", fontWeight: 700, letterSpacing: 0.2 },
    fontWeightBold: 800,
  },
};

const buildPalette = (mode) => {
  const common = {
    primary: { main: brand.green500, dark: brand.green700, light: brand.green400, contrastText: brand.black },
    success: { main: brand.green500, dark: brand.green700, light: brand.green400 },
    warning: { main: "#f9a825" },
    error: { main: "#ef5350" },
    info: { main: "#64b5f6" },
    divider: alpha("#e8eaed", 0.12),
    brand,
  };
  return {
    mode,
    ...common,
    text: { primary: "#e8eaed", secondary: "#b0b7c3", disabled: alpha("#e8eaed", 0.38) },
      background: { default: "#0e0f10", paper: "#17191b" },
  };
};

export const getDesignTokens = (mode) => ({
  palette: buildPalette(mode),
  ...base,
    components: {
      MuiCssBaseline: {
        styleOverrides: (t) => ({
          "html, body, #root": {
            height: "100%",
            backgroundColor: t.palette.background.default,
          },
          body: { color: "#e8eaed" },
          a: { color: t.palette.primary.light },
          "*:focus-visible": { outline: "none" },
        }),
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
          backgroundImage: "none",
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${alpha("#e8eaed", 0.08)}`,
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, fontWeight: 700 },
        containedPrimary: ({ theme }) => ({
          backgroundColor: theme.palette.primary.main,
          "&:hover": { backgroundColor: theme.palette.primary.dark },
          "&:active": { boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}` },
          "&:focus-visible": { boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.35)}` },
        }),
        outlinedPrimary: ({ theme }) => ({
          borderColor: alpha(theme.palette.primary.main, 0.6),
          "&:hover": { borderColor: theme.palette.primary.main, background: alpha(theme.palette.primary.main, 0.08) },
        }),
      },
    },
    MuiTabs: { styleOverrides: { indicator: ({ theme }) => ({ backgroundColor: theme.palette.primary.main, height: 3, borderRadius: 3 }) } },
    MuiChip: {
      styleOverrides: {
        colorSuccess: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.success.main, 0.15),
          color: theme.palette.success.light,
        }),
      },
    },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: "#1a1d20", border: `1px solid ${alpha("#e8eaed", 0.12)}` } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          "& fieldset": { borderColor: alpha("#e8eaed", 0.22) },
          "&:hover fieldset": { borderColor: alpha("#e8eaed", 0.35) },
          "&.Mui-focused fieldset": {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`,
          },
        }),
      },
    },
    MuiDialog: { styleOverrides: { paper: ({ theme }) => ({ backgroundColor: theme.palette.background.paper }) } },
  },
});

export function buildTheme(mode) {
  return responsiveFontSizes(createTheme(getDesignTokens(mode)));
}
