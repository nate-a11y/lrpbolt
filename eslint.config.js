import js from "@eslint/js";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  // Ignore build artifacts
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "functions/lib/**"] },

  // Base + plugins
  js.configs.recommended,
  { plugins: { import: importPlugin }, rules: importPlugin.configs.recommended.rules },
  react.configs.flat?.recommended ?? {
    plugins: { react },
    rules: { "react/jsx-uses-react": "off", "react/react-in-jsx-scope": "off" }
  },
  { plugins: { "react-hooks": hooks }, rules: hooks.configs.recommended.rules },

  // App defaults (browser ESM)
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
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
        node: { extensions: [".js", ".jsx", ".mjs"] },
        alias: {
          map: [
            ["@", "./src"],
            ["src", "./src"]
          ],
          extensions: [".js", ".jsx"]
        }
      },
      // Treat packages we don't want parsed as core (avoid import/named parse of their internals)
      "import/core-modules": ["vite", "msw", "msw/node", "jszip", "file-saver"]
    },
    plugins: {
      import: importPlugin,
      react,
      "react-hooks": hooks
    },
    rules: {
      // Style/sanity
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",            // disable PropTypes across app
      "import/no-duplicates": "warn",
      "import/order": ["warn", {
        "groups": ["builtin","external","internal","parent","sibling","index","object","type"],
        "newlines-between": "always"
      }],
      "import/no-named-as-default": "off",  // silence Lightbox named-as-default warning
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
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
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.es2021 }
    },
    // Turn off import-plugin deep checks for config files (prevents parsing 'vite')
    rules: {
      "import/no-unresolved": "off",
      "import/named": "off",
      "import/namespace": "off",
      "import/default": "off",
      "import/no-named-as-default-member": "off",
    }
  },

  // .mjs (allow top-level await)
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    }
  },

  // Service Worker
  {
    files: ["public/sw.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.worker,
        ...globals.browser
        // Do NOT redeclare importScripts/firebase here; we’ll manage in-file.
      }
    }
  },

  // Tests & mocks
  {
    files: ["tests/**", "src/mocks/**", "**/*.{test,spec}.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.jest, ...globals.browser, ...globals.node }
    },
    rules: {
      // Avoid import-plugin parsing msw internals
      "import/named": "off",
      "import/namespace": "off",
      "import/default": "off",
      "import/no-unresolved": "off"
    }
  }
];
