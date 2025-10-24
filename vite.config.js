import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";

import pkg from "./package.json" with { type: "json" };


export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.VITE_APP_VERSION || `v${pkg.version}`,
    ),
  },

  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: "src", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
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
        // Allow Rollup to hoist transitive imports so selector factories from
        // @mui/x-data-grid load in the correct order during production builds.
        hoistTransitiveImports: true,
        manualChunks: (id) => {
          // React core must load first to ensure React.version is available
          if (id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-is/") ||
              id.includes("node_modules/scheduler/")) {
            return "react-core";
          }

          // React ecosystem packages that depend on React
          // These load after react-core is initialized
          // Bundle ALL packages used by React/MUI to prevent CJS/ESM mismatches
          if (id.includes("node_modules/use-sync-external-store") ||
              id.includes("node_modules/react-transition-group") ||
              id.includes("node_modules/react-router") ||
              id.includes("node_modules/react-error-boundary") ||
              id.includes("node_modules/notistack") ||
              id.includes("node_modules/@emotion") ||
              id.includes("node_modules/hoist-non-react-statics") ||
              id.includes("node_modules/prop-types") ||
              id.includes("node_modules/dayjs") ||
              id.includes("node_modules/@babel/runtime") ||
              id.includes("node_modules/clsx") ||
              id.includes("node_modules/dom-helpers") ||
              id.includes("node_modules/@mui/")) {
            return "react-ecosystem";
          }

          // Large libraries that should be separate chunks
          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }

          if (id.includes("node_modules/three") ||
              id.includes("node_modules/@react-three")) {
            return "three";
          }

          // Other vendors
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
});
