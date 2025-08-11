/* Proprietary and confidential. See LICENSE. */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["react", "react-hooks", "jsx-a11y", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "eslint-config-prettier"
  ],
  settings: {
    react: { version: "detect" },
  },
  rules: {
    "no-empty": ["error", { "allowEmptyCatch": false }],
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "jsx-a11y/anchor-is-valid": "off",
    "no-unused-vars": "off",
    "jsx-a11y/no-autofocus": "off",
    "react-refresh/only-export-components": "off",
    "no-undef": "off"
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.test.jsx"],
      plugins: ["vitest-globals"],
      env: { node: true, "vitest-globals/env": true },
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
      }
    }
  ]
};
