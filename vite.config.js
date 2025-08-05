// vite.config.js

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// Helper to mirror the runtime dedupe done in the service worker. This ensures
// duplicate entries such as `manifest.webmanifest` are filtered out at build
// time as well.
const dedupeManifest = (entries) => {
  const seen = new Set();
  const manifest = entries.filter((e) => {
    const url = e.url.split("?")[0];
    if (seen.has(url)) return false;
    e.url = url;
    seen.add(url);
    return true;
  });
  return { manifest };
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      srcDir: ".",
      filename: "service-worker.js",
      strategies: "injectManifest",
      registerType: "autoUpdate",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Deduplicate entries like manifest.webmanifest that may be injected twice
        manifestTransforms: [dedupeManifest],
      },
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
