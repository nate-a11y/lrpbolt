import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const plugins = [
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
  ];

  if (env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT) {
    try {
      const { sentryVitePlugin } = await import("@sentry/vite-plugin");
      plugins.push(
        sentryVitePlugin({
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          include: "./dist",
          urlPrefix: "~/",
          release: {
            name:
              (env.GITHUB_SHA && env.GITHUB_SHA.slice(0, 7)) ||
              (env.VERCEL_GIT_COMMIT_SHA &&
                env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)) ||
              (env.COMMIT_SHA && env.COMMIT_SHA.slice(0, 7)) ||
              `manual-${new Date().toISOString()}`,
          },
          cleanArtifacts: false,
          disable: false,
        }),
      );
    } catch (err) {
      // Sentry plugin optional; skip if missing
    }
  }

  return {
    plugins,
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
  };
});
