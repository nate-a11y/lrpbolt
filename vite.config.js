// vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      cacheId: 'lrp-v2-2025-05-13',
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'offline.html',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-icon.png'
      ],
      manifest: {
        name: 'Lake Ride Pros',
        short_name: 'LRP',
        start_url: '.',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#4cbb17',
        description: 'Ride Claim & Time Clock Portal',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/\/$/, /\/index.html/, /\/claim-proxy\.php/],
        ignoreURLParametersMatching: [/./],
        navigationPreload: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/lakeridepros\.xyz\/claim-proxy\.php/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 3600 // 1 hour
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'asset-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 604800 // 7 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      timeUtils: path.resolve(__dirname, 'src/timeUtils.js')
    },
    extensions: ['.js', '.jsx'] // ✅ Ensures JSX is always resolved to JS at build
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html') // ✅ Ensures correct HTML entry
      },
      output: {
        // Use default chunk splitting to avoid runtime issues with manual chunks
      }
    }
  },
  base: './', // ✅ Relative paths (prevents absolute path issues on Hostinger)
  optimizeDeps: {
    include: [
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled'
    ]
  },
  server: {
    open: true,
    hmr: {
      overlay: true
    }
  }
});
