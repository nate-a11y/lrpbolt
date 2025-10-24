import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

import react from "@vitejs/plugin-react";

import pkg from "./package.json" with { type: "json" };


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || `v${pkg.version}`),
    },

    resolve: {
      alias: [
        { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
        { find: "src", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
        {
          find:
            "@mui/x-data-grid/hooks/features/virtualization/gridFocusedVirtualCellSelector.js",
          replacement: fileURLToPath(
            new URL(
              "./src/muiOverrides/gridFocusedVirtualCellSelector.js",
              import.meta.url,
            ),
          ),
        },
        {
          find:
            "@mui/x-data-grid/modern/hooks/features/virtualization/gridFocusedVirtualCellSelector.js",
          replacement: fileURLToPath(
            new URL(
              "./src/muiOverrides/gridFocusedVirtualCellSelector.js",
              import.meta.url,
            ),
          ),
        },
        {
          find:
            "@mui/x-data-grid/node/hooks/features/virtualization/gridFocusedVirtualCellSelector.js",
          replacement: fileURLToPath(
            new URL(
              "./src/muiOverrides/gridFocusedVirtualCellSelector.js",
              import.meta.url,
            ),
          ),
        },
        {
          find:
            "@mui/x-data-grid-pro/hooks/features/virtualization/gridFocusedVirtualCellSelector.js",
          replacement: fileURLToPath(
            new URL(
              "./src/muiOverrides/gridFocusedVirtualCellSelector.js",
              import.meta.url,
            ),
          ),
        },
        {
          find:
            "@mui/x-data-grid-pro/modern/hooks/features/virtualization/gridFocusedVirtualCellSelector.js",
          replacement: fileURLToPath(
            new URL(
              "./src/muiOverrides/gridFocusedVirtualCellSelector.js",
              import.meta.url,
            ),
          ),
        },
        {
          find:
            "@mui/x-data-grid-pro/node/hooks/features/virtualization/gridFocusedVirtualCellSelector.js",
          replacement: fileURLToPath(
            new URL(
              "./src/muiOverrides/gridFocusedVirtualCellSelector.js",
              import.meta.url,
            ),
          ),
        },
      ],
      dedupe: ["react", "react-dom", "react-is", "use-sync-external-store"],
      extensions: [".js", ".jsx"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
      sourcemap: true,
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("index.html", import.meta.url)),
        },
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          hoistTransitiveImports: true,
        },
      },
    },
    base: "/",
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "@mui/material",
        "@mui/icons-material",
        "@emotion/react",
        "@emotion/styled",
        "@mui/x-data-grid-pro",
        "@mui/x-data-grid",
        "reselect",
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "firebase/functions",
      ],
      needsInterop: [
        "react",
        "react-dom",
        "react-dom/client",
      ],
    },
    server: {
      open: true,
      hmr: {
        overlay: true,
      },
    },
  };
});
