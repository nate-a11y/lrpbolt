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
    const url = new URL(e.url, "http://dummy");
    url.search = ""; // remove ?__WB_REVISION__ etc
    const key = url.pathname + url.hash;
    if (seen.has(key)) return false;
    e.url = url.pathname + url.hash;
    seen.add(key);
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
      // Emit registerSW.js to the root and inject the registration script
      injectRegister: "script",
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
