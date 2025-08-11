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
      injectRegister: null,
      workbox: {
        cleanupOutdatedCaches: true,
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,webmanifest,json,png}"],
        manifestTransforms: [
          async (entries) => {
            const seen = new Set();
            const manifest = entries.filter((entry) => {
              if (!entry.url || !entry.revision) return false;
              entry.url = entry.url.split("?")[0];
              if (entry.url.endsWith("manifest.webmanifest")) {
                entry.url = "manifest.webmanifest";
              }
              if (seen.has(entry.url)) return false;
              seen.add(entry.url);
              return true;
            });
            return { manifest };
          },
        ],
      },
      strategy: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      manifest: {
        name: "LRP Driver Portal",
        short_name: "LRP",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#4cbb17",
        description: "Ride Claim & Time Clock Portal",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
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
    sourcemap: true,
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
});
