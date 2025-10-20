/* Proprietary and confidential. See LICENSE. */
import {
  CssVarsProvider,
  useColorScheme,
  extendTheme,
  responsiveFontSizes,
  alpha,
  getInitColorSchemeScript,
} from "@mui/material/styles";
import { CssBaseline, IconButton, Tooltip } from "@mui/material";
import { createContext, useCallback, useContext, useMemo } from "react";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";

const STORAGE_KEY = "lrp_color_scheme"; // 'light' | 'dark' | 'system'

const BRAND_GREEN = "#4cbb17";
const BRAND_GREEN_LIGHT = "#60e421";
const BRAND_GREEN_DARK = "#3a8e11";
const BRAND_BLACK = "#060606";

const brand = {
  green500: BRAND_GREEN,
  green400: BRAND_GREEN_LIGHT,
  green700: BRAND_GREEN_DARK,
  black: BRAND_BLACK,
  white: "#ffffff",
  grey200: "#e6e6e6",
};

const baseTypography = {
  button: { textTransform: "none", fontWeight: 700, letterSpacing: 0.2 },
  fontWeightBold: 800,
  h1: { fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)" },
  h2: { fontSize: "clamp(1.4rem, 2.2vw, 1.9rem)" },
  h3: { fontSize: "clamp(1.2rem, 2vw, 1.6rem)" },
  body1: { fontSize: "clamp(0.95rem, 1.2vw, 1rem)" },
  body2: { fontSize: "clamp(0.85rem, 1vw, 0.95rem)" },
  allVariants: { color: "var(--mui-palette-text-primary)" },
};

const transitions = {
  duration: {
    shortest: 120,
    shorter: 160,
    short: 200,
    standard: 200,
    complex: 250,
    enteringScreen: 220,
    leavingScreen: 180,
  },
};

const components = {
  MuiCssBaseline: {
    styleOverrides: {
      "html, body, #root": { height: "100%" },
      body: ({ theme }) => ({
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }),
      a: ({ theme }) => ({ color: theme.palette.primary.main }),
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          animationDuration: "0.001ms !important",
          animationIterationCount: "1 !important",
          transitionDuration: "0.001ms !important",
        },
        html: {
          scrollBehavior: "auto !important",
        },
      },
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
  MuiButtonBase: {
    styleOverrides: {
      root: {
        "&.Mui-focusVisible": {
          outline: `2px solid ${alpha(BRAND_GREEN, 0.45)}`,
          outlineOffset: 1,
        },
      },
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: theme.shape.borderRadius,
      }),
      containedPrimary: ({ theme }) => ({
        boxShadow: "none",
        "&:hover": {
          boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.22)}`,
        },
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
      tooltip: ({ theme }) => ({
        backgroundColor: theme.palette.mode === "dark" ? "#1a1d20" : "#f5f7fb",
        border: `1px solid ${alpha("#e8eaed", theme.palette.mode === "dark" ? 0.18 : 0.28)}`,
        color:
          theme.palette.mode === "dark"
            ? "#f8fafc"
            : theme.palette.text.primary,
      }),
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        "& fieldset": {
          borderColor: alpha(
            theme.palette.mode === "dark" ? "#e8eaed" : "#1f2933",
            theme.palette.mode === "dark" ? 0.22 : 0.14,
          ),
        },
        "&:hover fieldset": {
          borderColor: alpha(
            theme.palette.mode === "dark" ? "#e8eaed" : "#1f2933",
            theme.palette.mode === "dark" ? 0.35 : 0.24,
          ),
        },
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
  MuiInputBase: {
    styleOverrides: {
      root: { color: "var(--mui-palette-text-primary)" },
      input: { color: "var(--mui-palette-text-primary)" },
    },
  },
  MuiFormLabel: {
    styleOverrides: {
      root: { color: "var(--mui-palette-text-secondary)" },
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: { color: "var(--mui-palette-text-secondary)" },
    },
  },
  MuiFormHelperText: {
    styleOverrides: {
      root: { color: "var(--mui-palette-text-secondary)" },
    },
  },
  MuiDataGrid: {
    defaultProps: {
      density: "compact",
    },
    styleOverrides: {
      root: ({ theme }) => ({
        border: 0,
        borderRadius: theme.shape.borderRadius,
        backgroundColor: "var(--mui-palette-background-paper)",
        color: "var(--mui-palette-text-primary)",
        "--DataGrid-containerBackground": "var(--mui-palette-background-paper)",
        "--DataGrid-rowBorderColor": "var(--mui-palette-divider)",
        "--DataGrid-headerBorderColor": "var(--mui-palette-divider)",
        "--DataGrid-rowHoverBackground":
          "color-mix(in oklab, var(--mui-palette-primary-main) 8%, transparent)",
        "--DataGrid-selectedRowBackground":
          "color-mix(in oklab, var(--mui-palette-primary-main) 14%, transparent)",
        "--DataGrid-cellFocusOutline":
          "1px solid var(--mui-palette-primary-main)",
      }),
      columnHeaders: {
        backgroundColor:
          "color-mix(in oklab, var(--mui-palette-background-paper) 86%, var(--mui-palette-background-default))",
        color: "var(--mui-palette-text-secondary)",
        borderBottom: "1px solid var(--mui-palette-divider)",
      },
      toolbarContainer: {
        backgroundColor: "var(--mui-palette-background-paper)",
        borderBottom: "1px solid var(--mui-palette-divider)",
      },
      footerContainer: {
        backgroundColor: "var(--mui-palette-background-paper)",
        borderTop: "1px solid var(--mui-palette-divider)",
      },
      cell: {
        color: "var(--mui-palette-text-primary)",
      },
      row: {
        "&:hover": {
          backgroundColor: "var(--DataGrid-rowHoverBackground)",
        },
        "&.Mui-selected": {
          backgroundColor: "var(--DataGrid-selectedRowBackground) !important",
        },
      },
      iconSeparator: { color: "var(--mui-palette-divider)" },
      menuIcon: { color: "var(--mui-palette-text-secondary)" },
      sortIcon: { color: "var(--mui-palette-text-secondary)" },
      filterForm: { color: "var(--mui-palette-text-primary)" },
      checkboxInput: { color: "var(--mui-palette-text-secondary)" },
      columnHeaderTitle: { color: "var(--mui-palette-text-secondary)" },
      virtualScrollerRenderZone: {
        backgroundColor: "var(--mui-palette-background-paper)",
      },
    },
  },
};

const lightPalette = {
  mode: "light",
  ...{
    primary: {
      main: BRAND_GREEN,
      dark: BRAND_GREEN_DARK,
      light: BRAND_GREEN_LIGHT,
      contrastText: BRAND_BLACK,
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
      default: "#fafafa",
      paper: "#ffffff",
    },
    text: {
      primary: "#111111",
      secondary: "rgba(17,17,17,0.68)",
      disabled: alpha("#111111", 0.38),
    },
    divider: "rgba(0,0,0,0.12)",
    action: {
      active: "rgba(17,17,17,0.78)",
      hover: alpha(BRAND_GREEN, 0.08),
      selected: alpha(BRAND_GREEN, 0.12),
    },
  },
};

const darkPalette = {
  mode: "dark",
  ...{
    primary: {
      main: BRAND_GREEN,
      dark: BRAND_GREEN_DARK,
      light: BRAND_GREEN_LIGHT,
      contrastText: BRAND_BLACK,
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
      default: BRAND_BLACK,
      paper: "#0f0f0f",
    },
    text: {
      primary: "#ffffff",
      secondary: "rgba(255,255,255,0.72)",
      disabled: alpha("#ffffff", 0.38),
    },
    divider: "rgba(255,255,255,0.18)",
    action: {
      active: "rgba(255,255,255,0.85)",
      hover: alpha(BRAND_GREEN, 0.12),
      selected: alpha(BRAND_GREEN, 0.18),
    },
  },
};

export const theme = responsiveFontSizes(
  extendTheme({
    colorSchemes: {
      light: { palette: lightPalette },
      dark: { palette: darkPalette },
    },
    shape: { borderRadius: 14 },
    typography: baseTypography,
    transitions,
    components,
  }),
);

const ColorModeContext = createContext({
  mode: "system",
  resolvedMode: "light",
  setMode: () => {},
  toggle: () => {},
  cycleMode: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

export function LRPInitColorSchemeScript() {
  return getInitColorSchemeScript({
    defaultMode: "system",
    modeStorageKey: STORAGE_KEY,
  });
}

function ColorModeBridge({ children }) {
  const { mode, setMode, systemMode } = useColorScheme();
  const resolved = mode === "system" ? systemMode || "light" : mode || "light";

  const setAndStore = useCallback(
    (nextMode) => {
      setMode(nextMode);
    },
    [setMode],
  );

  const toggle = useCallback(() => {
    setAndStore(resolved === "dark" ? "light" : "dark");
  }, [resolved, setAndStore]);

  const cycleMode = useCallback(() => {
    const next =
      mode === "dark" ? "light" : mode === "light" ? "system" : "dark";
    setAndStore(next);
  }, [mode, setAndStore]);

  const value = useMemo(
    () => ({
      mode,
      resolvedMode: resolved,
      setMode: setAndStore,
      toggle,
      cycleMode,
    }),
    [mode, resolved, setAndStore, toggle, cycleMode],
  );

  return (
    <ColorModeContext.Provider value={value}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function ColorModeToggle({ iconButtonProps = {}, tooltipProps = {} }) {
  const { mode, resolvedMode, cycleMode } = useColorMode();

  const label = useMemo(() => {
    const base = mode || "light";
    const resolved = resolvedMode || base;
    return `${base}${mode === "system" ? ` (resolved: ${resolved})` : ""}`;
  }, [mode, resolvedMode]);

  const icon =
    resolvedMode === "dark" ? (
      <DarkModeIcon />
    ) : resolvedMode === "light" ? (
      <LightModeIcon />
    ) : (
      <SettingsBrightnessIcon />
    );

  return (
    <Tooltip title={`Theme: ${label}`} {...tooltipProps}>
      <IconButton
        onClick={(event) => {
          event.stopPropagation?.();
          cycleMode();
        }}
        size="small"
        aria-label={`Cycle color scheme (currently ${label})`}
        {...iconButtonProps}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

export default function ColorSchemeProvider({ children }) {
  return (
    <CssVarsProvider
      defaultMode="system"
      modeStorageKey={STORAGE_KEY}
      disableTransitionOnChange
      theme={theme}
    >
      <CssBaseline />
      <ColorModeBridge>{children}</ColorModeBridge>
    </CssVarsProvider>
  );
}

export { ColorModeContext };
