import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: "src", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
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
