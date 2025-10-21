// src/theme/getTheme.js (replace your file with this)
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
      background: { default: BRAND.darkBg, paper: "#0b0b0b" },
      text: { primary: "#ffffff", secondary: "rgba(255,255,255,0.72)" },
      divider: "rgba(255,255,255,0.12)",
      success: { main: "#25c26e" },
      warning: { main: "#f5a524" },
      error: { main: "#f04438" },
      info: { main: "#3b82f6" },
      brand: brandTokens,
      lrp: {
        gradient:
          "linear-gradient(180deg, rgba(76,187,23,0.18) 0%, rgba(6,6,6,0) 100%)",
        gradientPanel:
          "linear-gradient(180deg, rgba(76,187,23,0.12) 0%, rgba(6,6,6,0) 100%)",
        gradientRing:
          "radial-gradient(closest-side, rgba(76,187,23,0.18), rgba(6,6,6,0) 70%)",
      },
    };
  }
  return {
    mode,
    primary: { main: BRAND.primary, contrastText: "#051105" },
    background: { default: "#ffffff", paper: "#f8f9f8" },
    text: { primary: "#060606", secondary: "rgba(6,6,6,0.7)" },
    divider: "rgba(6,6,6,0.1)",
    success: { main: "#138a4d" },
    warning: { main: "#b87400" },
    error: { main: "#d12828" },
    info: { main: "#1d4ed8" },
    brand: brandTokens,
    lrp: {
      gradient:
        "linear-gradient(180deg, rgba(76,187,23,0.18) 0%, rgba(6,6,6,0) 100%)",
      gradientPanel:
        "linear-gradient(180deg, rgba(76,187,23,0.06) 0%, rgba(255,255,255,0) 100%)",
      gradientRing:
        "radial-gradient(closest-side, rgba(76,187,23,0.09), rgba(255,255,255,0) 70%)",
    },
  };
}

export function getTheme(mode = "dark") {
  const palette = paletteFor(mode);
  return createTheme({
    palette,
    shape: { borderRadius: 14 },
    typography: {
      fontFamily:
        'Inter, system-ui, -apple-system, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
      h1: {
        fontFamily: '"Boardson", Inter, system-ui, sans-serif',
        fontWeight: 700,
        letterSpacing: "-0.02em",
      },
      h2: {
        fontFamily: '"Boardson", Inter, system-ui, sans-serif',
        fontWeight: 800,
        letterSpacing: "-0.02em",
        fontSize: "clamp(1.375rem, 1.2rem + 1.2vw, 2rem)",
        lineHeight: 1.2,
      },
      h3: {
        fontFamily: '"Boardson", Inter, system-ui, sans-serif',
        fontWeight: 700,
        letterSpacing: "-0.015em",
      },
      subtitle1: {
        fontFamily: '"CelebriSans", Inter, system-ui, sans-serif',
        fontWeight: 700,
        letterSpacing: "-0.01em",
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
            paddingTop: "var(--appbar-h, 64px)",
            transition: "background-color 0.25s ease, color 0.25s ease",
          },
          ":root": {
            "--lrp-safe-top": "env(safe-area-inset-top)",
            "--lrp-safe-bottom": "env(safe-area-inset-bottom)",
          },
          // neutralize any leftover hardcoded dark helpers by mapping to tokens
          ".lrp-dark, .lrp-dark-bg, .bg-black": {
            backgroundColor: `${palette.background.paper} !important`,
          },
          ".lrp-panel-glow": ({ theme }) => ({
            backgroundImage: theme.palette.lrp.gradientPanel,
          }),
          ".lrp-ring-glow": ({ theme }) => ({
            backgroundImage: theme.palette.lrp.gradientRing,
          }),
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },

      // Buttons themed only via tokens
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

      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
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

      // Inputs use white/black via theme tokens (no raw hex)
      MuiInputBase: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.common.white, 0.06)
                : alpha(theme.palette.common.black, 0.02),
          }),
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.common.white, 0.06)
                : alpha(theme.palette.common.black, 0.02),
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.common.white, 0.1)
                  : alpha(theme.palette.common.black, 0.05),
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
                ? alpha(theme.palette.common.white, 0.04)
                : alpha(theme.palette.common.black, 0.01),
          }),
          notchedOutline: ({ theme }) => ({
            borderColor: theme.palette.divider,
          }),
        },
      },

      // Tabs/Chips accent color via tokens
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

      MuiDataGrid: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            borderColor: theme.palette.divider,
            "--DataGrid-rowBorderColor": theme.palette.divider,

            // Make sure internal containers can’t go dark in light mode
            "& .MuiDataGrid-virtualScroller, & .MuiDataGrid-virtualScrollerContent":
              {
                backgroundColor: theme.palette.background.paper,
              },

            // cells/rows/borders
            "& .MuiDataGrid-cell": {
              borderColor: theme.palette.divider,
              color: theme.palette.text.primary,
            },
            "& .MuiDataGrid-row": {
              // light zebra only in light mode
              "&:nth-of-type(even)": {
                backgroundColor:
                  theme.palette.mode === "light"
                    ? theme.palette.action.hover
                    : "transparent",
              },
            },

            // header row
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: theme.palette.background.paper,
              borderBottom: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            },

            // toolbar (the black band culprit)
            "& .MuiDataGrid-toolbarContainer": {
              backgroundColor: theme.palette.background.paper,
              borderBottom: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.secondary,
            },

            // footer (pagination/status)
            "& .MuiDataGrid-footerContainer": {
              backgroundColor: theme.palette.background.paper,
              borderTop: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.secondary,
            },

            // quick filter input inside toolbar
            "& .MuiDataGrid-toolbarQuickFilter": {
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
              "& input": { color: theme.palette.text.primary },
            },

            // column header titles/icons
            "& .MuiDataGrid-columnHeaderTitle": {
              color: theme.palette.text.primary,
            },
            "& .MuiDataGrid-iconSeparator": {
              color: theme.palette.divider,
            },
            "& .MuiSvgIcon-root": {
              color: theme.palette.text.secondary,
            },

            // filter panel and forms match the surface
            "& .MuiDataGrid-panel": {
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
            },
            "& .MuiDataGrid-filterForm": {
              color: theme.palette.text.primary,
            },
          }),
        },
      },

      // Menus/Tooltips/Popovers/Autocomplete — tokens only
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
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
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.common.white, 0.08)
                : alpha(theme.palette.common.black, 0.9),
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
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
