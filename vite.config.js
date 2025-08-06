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
        globPatterns: ["**/*.{js,css,html,webmanifest,json}"],
      },
      strategy: "injectManifest",
      srcDir: ".", // service worker lives at project root
      filename: "service-worker.js",
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
    extensions: [".js", ".jsx"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'service-worker.js') return '[name].[ext]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  base: "./",
  optimizeDeps: {
    include: [
      "@mui/material",
      "@mui/icons-material",
      "@emotion/react",
      "@emotion/styled",
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
