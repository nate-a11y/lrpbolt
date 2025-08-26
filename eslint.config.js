/* eslint-disable import/no-commonjs */
import js from "@eslint/js";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

// Optional: if you previously used react-refresh rule, you can import it:
// import reactRefresh from "eslint-plugin-react-refresh";

export default [
  // Ignore build artifacts
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "functions/lib/**"] },

  // Base recommended configs
  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  // React flat config (plugin >=7.34 provides .configs.flat.recommended)
  react.configs.flat?.recommended ?? {
    plugins: { react },
    rules: { "react/jsx-uses-react": "off", "react/react-in-jsx-scope": "off" }
  },
  { plugins: { "react-hooks": hooks }, rules: hooks.configs.recommended.rules },

  // App defaults (browser ESM)
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.jest
      }
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs"] },
        alias: {
          map: [
            ["@", "./src"],
            ["src", "./src"]
          ],
          extensions: [".js", ".jsx", ".ts", ".tsx"]
        }
      }
    },
    rules: {
      // Style/sanity
      "react/react-in-jsx-scope": "off",
      "import/no-duplicates": "warn",
      "import/order": ["warn", {
        "groups": ["builtin","external","internal","parent","sibling","index","object","type"],
        "newlines-between": "always"
      }],
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // If you used this previously and had errors, keep it OFF or switch to "warn"
      // "react-refresh/only-export-components": "off"
    }
  },

  // Node/CommonJS overrides (configs, scripts, Firebase Functions)
  {
    files: [
      "vite.config.*",
      "vitest.config.*",
      "babel.config.*",
      "jest.config.*",
      "scripts/**",
      "functions/**/*.js"
    ],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node, ...globals.es2021 }
    },
    rules: {
      "import/no-unresolved": "off" // config loaders can be non-standard
    }
  },

  // Service Worker override
  {
    files: ["src/sw.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.worker,
        ...globals.browser,
        // declare compat globals used by FCM SW if any
        importScripts: "readonly",
        firebase: "readonly"
      }
    }
  },

  // Tests
  {
    files: ["tests/**", "**/*.{test,spec}.{js,jsx,ts,tsx}"],
    languageOptions: { globals: { ...globals.jest, ...globals.browser } },
    rules: { "import/named": "off" }
  }
];
