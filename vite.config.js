// vite.config.js

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
      strategies: "injectManifest",
      srcDir: ".",
      filename: "service-worker.js",
      injectRegister: "script",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      timeUtils: path.resolve(__dirname, "src/utils/timeUtils.js"),
    },
    extensions: [".js", ".jsx"], // ✅ Ensures JSX is always resolved to JS at build
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"), // ✅ Ensures correct HTML entry
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  base: "./", // ✅ Relative paths (prevents absolute path issues on Hostinger)
  optimizeDeps: {
    include: [
      "@mui/material",
      "@mui/icons-material",
      "@emotion/react",
      "@emotion/styled",
    ],
  },
  server: {
    open: true,
    hmr: {
      overlay: true,
    },
  },
});
