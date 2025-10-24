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
          manualChunks: (id) => {
            if (id.includes("node_modules/react/")) {
              return "react-core";
            }

            if (
              id.includes("node_modules/@mui/x-data-grid") ||
              id.includes("node_modules/@mui/x-data-grid-pro") ||
              id.includes("node_modules/@mui/x-data-grid-premium") ||
              id.includes("node_modules/reselect") ||
              id.includes("src/muiOverrides/gridFocusedVirtualCellSelector.js")
            ) {
              return "mui-x-data-grid";
            }

            if (
              id.includes("node_modules/@mui/") ||
              id.includes("node_modules/@emotion/") ||
              id.includes("node_modules/notistack") ||
              id.includes("node_modules/dayjs") ||
              id.includes("node_modules/@babel/runtime") ||
              id.includes("node_modules/clsx") ||
              id.includes("node_modules/dom-helpers") ||
              id.includes("node_modules/hoist-non-react-statics") ||
              id.includes("node_modules/prop-types") ||
              id.includes("node_modules/react-transition-group") ||
              id.includes("node_modules/react-router") ||
              id.includes("node_modules/react-error-boundary") ||
              id.includes("node_modules/use-sync-external-store")
            ) {
              return "react-ecosystem";
            }

            if (id.includes("node_modules/firebase")) {
              return "firebase";
            }

            if (
              id.includes("node_modules/three") ||
              id.includes("node_modules/@react-three")
            ) {
              return "three";
            }

            if (id.includes("node_modules")) {
              return "vendor";
            }
          },
        },
      },
    },
    base: "/",
    optimizeDeps: {
      include: [
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
    },
    server: {
      open: true,
      hmr: {
        overlay: true,
      },
    },
  };
});
