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

const base = {
  shape: { borderRadius: 14 },
  typography: {
    button: { textTransform: "none", fontWeight: 700, letterSpacing: 0.2 },
    fontWeightBold: 800,
  },
};

const buildPalette = (mode) => {
  const isDark = mode === "dark";
  const basePalette = {
    mode,
    primary: {
      main: LRP_GREEN,
      dark: brand.green700,
      light: brand.green400,
      contrastText: brand.black,
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
      default: isDark ? LRP_BLACK : "#f7f7f7",
      paper: isDark ? "#0b0b0b" : "#ffffff",
    },
    text: {
      primary: isDark ? "#ffffff" : "#111111",
      secondary: isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.68)",
      disabled: alpha(isDark ? "#ffffff" : "#111111", 0.38),
    },
    divider: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
  };

  return basePalette;
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
        root: {
          borderRadius: 14,
          textTransform: "none",
          fontWeight: 600,
          "&:focus-visible": {
            outline: `2px solid ${LRP_GREEN}`,
            outlineOffset: 2,
          },
        },
        containedPrimary: ({ theme }) => ({
          backgroundColor: theme.palette.primary.main,
          "&:hover": { backgroundColor: theme.palette.primary.dark },
          "&:active": {
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}`,
          },
          "&:focus-visible": {
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.35)}`,
          },
          boxShadow: "0 6px 18px rgba(76,187,23,0.28)",
        }),
        outlinedPrimary: ({ theme }) => ({
          borderColor: alpha(theme.palette.primary.main, 0.6),
          "&:hover": {
            borderColor: theme.palette.primary.main,
            background: alpha(theme.palette.primary.main, 0.08),
          },
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderRadius: 18,
          border: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: ({ theme }) => ({
          backgroundColor: theme.palette.primary.main,
          height: 3,
          borderRadius: 3,
        }),
      },
    },
    MuiChip: {
      defaultProps: { size: "small" },
      styleOverrides: {
        colorSuccess: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.success.main, 0.15),
          color: theme.palette.success.light,
        }),
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#1a1d20",
          border: `1px solid ${alpha("#e8eaed", 0.12)}`,
        },
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
      defaultProps: {
        density: "compact",
      },
      styleOverrides: {
        root: ({ theme }) => ({
          border: 0,
          borderRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          "--DataGrid-rowBorderColor": "rgba(255,255,255,0.08)",
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            borderBottom: "1px solid rgba(255,255,255,0.12)",
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
          },
          "& .MuiDataGrid-row:hover": {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
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
        cell: {
          outline: "none !important",
        },
        columnHeaders: {
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        },
      },
    },
  },
});

export const buildTheme = (mode) =>
  responsiveFontSizes(createTheme(getDesignTokens(mode)));
