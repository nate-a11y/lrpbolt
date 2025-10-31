import js from "@eslint/js";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  // Ignore build artifacts
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "functions/lib/**", "src/vendor/**", ".archive/**", "public/sw.js", "public/firebase-messaging-sw.js"] },

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
      "import/no-duplicates": "error",      // stricter: duplicates are errors
      "import/order": ["warn", {
        "groups": ["builtin","external","internal","parent","sibling","index","object","type"],
        "newlines-between": "always"
      }],
      "import/no-named-as-default": "off",  // silence Lightbox named-as-default warning
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],

      // Hooks (stricter)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",  // stricter: exhaustive deps is now error
      "react-hooks/preserve-manual-memoization": "warn",  // React Compiler optimization hints as warnings

      // Code quality
      "no-debugger": "error",                  // no debugger statements
      "no-alert": "warn",                      // discourage alert/confirm/prompt
      "eqeqeq": ["error", "always", { "null": "ignore" }],  // require === and !==
      "no-var": "error",                       // use const/let instead of var
      "prefer-const": "error",                 // prefer const when variable is not reassigned
      "no-implicit-globals": "error",          // prevent accidental globals
      "no-console": ["warn", { "allow": ["warn", "error"] }],  // warn on console.log, allow warn/error

      // React specific
      "react/jsx-no-target-blank": ["error", { "allowReferrer": false }],  // require rel="noopener"
      "react/no-array-index-key": "warn",      // warn when using array index as key
      "react/jsx-key": "error",                // require key prop in lists
      "react/no-unescaped-entities": "error"   // prevent unescaped HTML entities
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
      "no-console": "off",  // allow console in scripts and functions
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
