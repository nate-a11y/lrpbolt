import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'Color logo with background.svg',
        'robots.txt',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
        'icons/icon-512.png',
      ],
      manifest: {
        name: 'LRP Driver Portal',
        short_name: 'LRP Portal',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#111111',
        theme_color: '#00c853',
        icons: [
          { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        // bump if you ship large bundles
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      src: path.resolve(__dirname, "src"),
      timeUtils: path.resolve(__dirname, "src/utils/timeUtils.js"),
    },
    dedupe: ["react", "react-dom"],
    extensions: [".js", ".jsx", ".ts", ".tsx"],
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
});
