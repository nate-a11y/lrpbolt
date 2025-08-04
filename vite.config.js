// vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react()
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
