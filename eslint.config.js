import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginImport from "eslint-plugin-import";

export default [
  {
    ignores: [
      "dist/",
      "build/",
      "node_modules/",
      "**/*.min.js",
      "coverage/",
      "firebase-debug.log",
      "functions/lib/"
    ]
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest
      }
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      import: pluginImport
    },
    settings: {
      react: { version: "detect" }
    },
    rules: {
      ...js.configs.recommended.rules,
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // LRP portal prefs:
      "no-empty": ["error", { "allowEmptyCatch": false }],
      "import/order": ["warn", { "newlines-between": "always" }],
      "react/prop-types": "off", // if you're on JS without PropTypes
      "no-use-before-define": ["error", { functions: false, classes: true, variables: true }],
      "import/no-cycle": "warn"
    }
  }
];
