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
        // Temporarily disable manual chunking to fix React initialization order issues
        manualChunks: undefined,
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
