/* Proprietary and confidential. See LICENSE. */
import { createTheme, responsiveFontSizes, alpha } from "@mui/material/styles";

export const brand = {
  green500: "#4cbb17",
  green400: "#60e421",
  green700: "#3a8e11",
  black: "#060606",
  white: "#ffffff",
  grey200: "#e6e6e6",
};

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
    brand,
  };
  if (mode === "dark") {
    return {
      mode,
      ...common,
      text: { primary: "#e8eaed", secondary: "#b0b7c3", disabled: alpha("#e8eaed", 0.38) },
      background: { default: "#060606", paper: "#0b0b0b" },
      divider: alpha("#ffffff", 0.12),
    };
  }
  return {
    mode,
    ...common,
    background: { default: "#fafafa", paper: "#ffffff" },
    divider: "rgba(0,0,0,0.12)",
  };
};

export const getDesignTokens = (mode) => ({
  palette: buildPalette(mode),
  ...base,
  typography: {
    ...base.typography,
    h1: { fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)" },
    h2: { fontSize: "clamp(1.4rem, 2.2vw, 1.9rem)" },
    h3: { fontSize: "clamp(1.2rem, 2vw, 1.6rem)" },
    body1: { fontSize: "clamp(0.95rem, 1.2vw, 1rem)" },
    body2: { fontSize: "clamp(0.85rem, 1vw, 0.95rem)" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body, #root": { height: "100%" },
        body: ({ theme }) => ({
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
        }),
        a: ({ theme }) => ({ color: theme.palette.primary.main }),
        "*:focus-visible": { outline: "none" },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 2 },
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
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, fontWeight: 700, textTransform: "none" },
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
    MuiTabs: {
      styleOverrides: {
        indicator: ({ theme }) => ({ backgroundColor: theme.palette.primary.main, height: 3, borderRadius: 3 }),
      },
    },
    MuiChip: {
      styleOverrides: {
        colorSuccess: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.success.main, 0.15),
          color: theme.palette.success.light,
        }),
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: "#1a1d20", border: `1px solid ${alpha("#e8eaed", 0.12)}` },
      },
    },
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
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          margin: 8,
          width: "min(100%, 560px)",
        }),
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: false },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: "8px",
          "@media (max-width:600px)": { padding: "6px" },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", fullWidth: true },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

export const buildTheme = (mode) => responsiveFontSizes(createTheme(getDesignTokens(mode)));

