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
      {
        find: /^dayjs$/,
        replacement: fileURLToPath(
          new URL("./src/utils/dayjsSetup.js", import.meta.url),
        ),
      },
    ],
    dedupe: ["react", "react-dom", "react-is"],
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
        manualChunks: (id) => {
          // React core libraries + Emotion (Emotion depends on React hooks, must load together)
          if (id.includes("node_modules/react") ||
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/@emotion")) {
            return "react-core";
          }
          if (id.includes("node_modules/react-router-dom")) {
            return "react-router";
          }

          // MUI Core (Material-UI base)
          if (id.includes("node_modules/@mui/material") ||
              id.includes("node_modules/@mui/system")) {
            return "mui-core";
          }

          // MUI Icons
          if (id.includes("node_modules/@mui/icons-material")) {
            return "mui-icons";
          }

          // MUI X Data Grid
          if (id.includes("node_modules/@mui/x-data-grid")) {
            return "mui-datagrid";
          }

          // MUI X Date Pickers
          if (id.includes("node_modules/@mui/x-date-pickers")) {
            return "mui-datepickers";
          }

          // MUI X Charts
          if (id.includes("node_modules/@mui/x-charts")) {
            return "mui-charts";
          }

          // Firebase
          if (id.includes("node_modules/firebase") ||
              id.includes("node_modules/@firebase")) {
            return "firebase";
          }

          // Three.js and related
          if (id.includes("node_modules/three") ||
              id.includes("node_modules/@react-three")) {
            return "three";
          }

          // Framer Motion
          if (id.includes("node_modules/framer-motion")) {
            return "framer-motion";
          }

          // QR Code libraries
          if (id.includes("node_modules/html5-qrcode") ||
              id.includes("node_modules/@zxing") ||
              id.includes("node_modules/react-qr-code")) {
            return "qr-code";
          }

          // File processing libraries
          if (id.includes("node_modules/jszip") ||
              id.includes("node_modules/papaparse") ||
              id.includes("node_modules/file-saver")) {
            return "file-utils";
          }

          // Monitoring and error tracking
          if (id.includes("node_modules/@sentry")) {
            return "sentry";
          }

          // Image processing
          if (id.includes("node_modules/html-to-image")) {
            return "image-utils";
          }

          // Utility libraries
          if (id.includes("node_modules/dayjs") ||
              id.includes("node_modules/uuid") ||
              id.includes("node_modules/axios")) {
            return "utils";
          }

          // Other UI libraries
          if (id.includes("node_modules/notistack") ||
              id.includes("node_modules/nprogress") ||
              id.includes("node_modules/yet-another-react-lightbox")) {
            return "ui-libs";
          }

          // Vendor chunk for remaining node_modules
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
