import { createTheme, alpha } from "@mui/material/styles";

const BRAND = {
  primary: "#4cbb17", // LRP green
  darkBg: "#060606", // LRP dark background
};

const brandTokens = {
  green500: BRAND.primary,
  green400: "#60e421",
  green700: "#3a8e11",
  black: BRAND.darkBg,
  white: "#ffffff",
  grey200: "#e6e6e6",
};

function paletteFor(mode) {
  if (mode === "dark") {
    return {
      mode,
      primary: { main: BRAND.primary, contrastText: "#081208" },
      background: { default: BRAND.darkBg, paper: "#0c0f0c" },
      text: { primary: "#e9f0e9", secondary: "#b7c2b7" },
      divider: alpha("#ffffff", 0.12),
      success: { main: "#25c26e" },
      warning: { main: "#f5a524" },
      error: { main: "#f04438" },
      info: { main: "#3b82f6" },
      brand: brandTokens,
    };
  }
  return {
    mode,
    primary: { main: BRAND.primary, contrastText: "#051105" },
    background: { default: "#f6faf6", paper: "#ffffff" },
    text: { primary: "#0b120b", secondary: "#4a5a4a" },
    divider: alpha("#052005", 0.12),
    success: { main: "#138a4d" },
    warning: { main: "#b87400" },
    error: { main: "#d12828" },
    info: { main: "#1d4ed8" },
    brand: brandTokens,
  };
}

export function getTheme(mode = "dark") {
  const palette = paletteFor(mode);
  return createTheme({
    palette,
    shape: { borderRadius: 14 },
    typography: {
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
      h1: { fontWeight: 700 },
      // Keep headings bold but mobile-friendly
      h2: {
        fontWeight: 800,
        letterSpacing: "-0.02em",
        // ~22px on xs, grows to ~32px on md+
        fontSize: "clamp(1.375rem, 1.2rem + 1.2vw, 2rem)",
        lineHeight: 1.2,
      },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "html, body, #root": { height: "100%" },
          body: {
            backgroundColor: palette.background.default,
            color: palette.text.primary,
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
            // Reserve space for the fixed AppBar. BrandHeader sets --appbar-h at runtime.
            paddingTop: "var(--appbar-h, 64px)",
          },
          // Mobile safe-area
          ":root": {
            "--lrp-safe-top": "env(safe-area-inset-top)",
            "--lrp-safe-bottom": "env(safe-area-inset-bottom)",
          },
          // neutralize any leftover hardcoded dark helpers
          ".lrp-dark, .lrp-dark-bg, .bg-black": {
            backgroundColor: `${palette.background.paper} !important`,
          },
        },
      },
      // Give the AppBar a consistent surface & divider
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      // Buttons look consistent in both modes
      MuiButton: {
        variants: [
          {
            props: { size: "small" },
            style: { borderRadius: 12, minHeight: 32, paddingInline: 12 },
          },
          { props: { variant: "contained" }, style: { boxShadow: "none" } },
          {
            props: { variant: "outlined" },
            style: ({ theme }) => ({ borderColor: theme.palette.divider }),
          },
        ],
      },
      // Paper matches brand, slight border for contrast
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            border: `1px solid ${theme.palette.divider}`,
            // prevent rogue black cards in light mode
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.primary,
          }),
        },
      },
      // Inputs/Selects readable in both modes
      MuiInputBase: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha("#ffffff", 0.06)
                : alpha("#000000", 0.02),
          }),
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha("#ffffff", 0.06)
                : alpha("#000000", 0.02),
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha("#ffffff", 0.1)
                  : alpha("#000000", 0.05),
            },
            "&.Mui-focused": { backgroundColor: "transparent" },
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha("#ffffff", 0.04)
                : alpha("#000000", 0.01),
          }),
          notchedOutline: ({ theme }) => ({
            borderColor: theme.palette.divider,
          }),
        },
      },
      // Tabs/Chips accent color
      MuiTabs: {
        styleOverrides: {
          indicator: ({ theme }) => ({
            backgroundColor: theme.palette.primary.main,
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          colorPrimary: ({ theme }) => ({
            backgroundColor: alpha(theme.palette.primary.main, 0.16),
            color: theme.palette.primary.main,
          }),
        },
      },
      // DataGrid — unify all surfaces (headers, body, footer)
      MuiDataGrid: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            borderColor: theme.palette.divider,
            border: 0,
            "--DataGrid-rowBorderColor": theme.palette.divider,
            "& .MuiDataGrid-virtualScroller": {
              backgroundColor: theme.palette.background.paper,
            },
            "& .MuiDataGrid-virtualScrollerContent": {
              backgroundColor: theme.palette.background.paper,
            },
          }),
          columnHeaders: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? theme.palette.grey[900]
                : theme.palette.grey[100],
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
          columnHeader: ({ theme }) => ({
            color: theme.palette.text.secondary,
          }),
          toolbarContainer: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? theme.palette.grey[900]
                : theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.divider}`,
            "& .MuiButtonBase-root, & .MuiIconButton-root, & .MuiSvgIcon-root":
              {
                color: theme.palette.text.secondary,
              },
          }),
          footerContainer: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? theme.palette.grey[900]
                : theme.palette.background.paper,
            borderTop: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.secondary,
          }),
          row: ({ theme }) => ({
            "&:nth-of-type(even)": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "transparent"
                  : theme.palette.action.hover,
            },
          }),
          cell: ({ theme }) => ({
            borderColor: theme.palette.divider,
          }),
          filterForm: ({ theme }) => ({
            color: theme.palette.text.primary,
          }),
          panel: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      // Menus/Tooltips should be readable
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      // Menus/Autocomplete poppers must match paper
      MuiPopover: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            backgroundColor: theme.palette.mode === "dark" ? "#111" : "#2f2f2f",
          }),
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: ({ theme }) => ({
            background: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiLink: {
        styleOverrides: {
          root: ({ theme }) => ({ color: theme.palette.primary.main }),
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&.Mui-selected": {
              backgroundColor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === "dark" ? 0.18 : 0.12,
              ),
            },
          }),
        },
      },
    },
  });
}

export { paletteFor, brandTokens as brand, BRAND as brandBase };
export const buildTheme = getTheme;
export default getTheme;
