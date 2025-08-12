// vite.config.js
import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA(
      mode === "development"
        ? { disable: true }
        : {
            registerType: "autoUpdate",
            injectRegister: null,
            strategies: "generateSW",
            workbox: {
              cleanupOutdatedCaches: true,
              skipWaiting: true,
              clientsClaim: true,
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              // only precache core assets; skip huge images
              globPatterns: ["**/*.{html,js,css,ico,svg,webmanifest}"],
              globIgnores: ["**/DropOffPics/**"],
              runtimeCaching: [
                {
                  // Runtime cache for large DropOffPics
                  urlPattern: ({ url }) => url.pathname.startsWith("/DropOffPics/"),
                  handler: "CacheFirst",
                  options: {
                    cacheName: "dropoff-pics",
                    expiration: {
                      maxEntries: 120,
                      maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                    },
                  },
                },
                {
                  // All other images get SWR
                  urlPattern: ({ request }) => request.destination === "image",
                  handler: "StaleWhileRevalidate",
                  options: {
                    cacheName: "images",
                    expiration: {
                      maxEntries: 200,
                      maxAgeSeconds: 60 * 60 * 24 * 30,
                    },
                  },
                },
              ],
            },
            manifest: {
              name: "LRP Driver Portal",
              short_name: "LRP",
              start_url: "/",
              display: "standalone",
              background_color: "#ffffff",
              theme_color: "#4cbb17",
              description: "Ride Claim & Time Clock Portal",
              version: "1.0.1",
              icons: [
                { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
              ],
            },
            devOptions: {
              enabled: true,
            },
          }
    ),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      timeUtils: path.resolve(__dirname, "src/utils/timeUtils.js"),
    },
    dedupe: ["react", "react-dom"],
    extensions: [".js", ".jsx"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'sw.js') return '[name].[ext]';
          return 'assets/[name]-[hash][extname]';
        },
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
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  server: {
    open: true,
    hmr: {
      overlay: true,
    },
  },
}));
