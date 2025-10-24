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
        // Prevent hoisting to preserve module initialization order
        hoistTransitiveImports: false,
        manualChunks: (id) => {
          // React + Emotion must be in same chunk to prevent initialization errors
          if (id.includes("node_modules/react") ||
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react-is") ||
              id.includes("node_modules/scheduler") ||
              id.includes("node_modules/@emotion") ||
              id.includes("node_modules/hoist-non-react-statics")) {
            return "react-vendor";
          }

          // MUI Core
          if (id.includes("node_modules/@mui/material") ||
              id.includes("node_modules/@mui/system")) {
            return "mui-core";
          }

          // Large libraries that should be separate chunks
          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }

          if (id.includes("node_modules/three") ||
              id.includes("node_modules/@react-three")) {
            return "three";
          }

          if (id.includes("node_modules/@mui/x-data-grid")) {
            return "mui-datagrid";
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
