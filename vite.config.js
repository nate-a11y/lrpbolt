import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        globDirectory: "dist",
        globPatterns: ["**/*.{html,js,css}", "assets/**/*.{js,css}"],
        // Don’t precache external URLs
      },
      workbox: {
        cleanupOutdatedCaches: true,
      },
      // minimal manifest; adjust as needed
      manifest: {
        name: "Lake Ride Pros",
        short_name: "LRP",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      devOptions: { enabled: false }, // NEVER run SW in dev
    }),
    sentryVitePlugin({
      // Sentry picks these up from env at build time; do NOT hardcode secrets.
      // Requires: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Upload all sourcemaps from dist
      include: "./dist",
      urlPrefix: "~/",

      // Release name derived from CI SHA or timestamp as fallback
      release: {
        name:
          (process.env.GITHUB_SHA && process.env.GITHUB_SHA.slice(0, 7)) ||
          (process.env.VERCEL_GIT_COMMIT_SHA && process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)) ||
          (process.env.COMMIT_SHA && process.env.COMMIT_SHA.slice(0, 7)) ||
          `manual-${new Date().toISOString()}`,
      },

      // Clean uploaded artifacts from the local dist after upload? Keep false.
      cleanArtifacts: false,

      // Silence if envs missing (local dev)
      disable: !process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT,
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      src: fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
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
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          mui: ["@mui/material", "@emotion/react", "@emotion/styled"],
          dayjs: ["dayjs"],
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
