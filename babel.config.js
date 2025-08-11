module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        // Adjust targets as needed for your supported browsers
        targets: ">0.5%, not dead, not op_mini all"
      }
    ]
  ],
  plugins: [
    // ✅ Correct, maintained transforms (replace all old "proposal-*" usage)
    "@babel/plugin-transform-class-properties",
    "@babel/plugin-transform-private-methods",
    "@babel/plugin-transform-private-property-in-object",
    "@babel/plugin-transform-optional-chaining",
    "@babel/plugin-transform-nullish-coalescing-operator",
    "@babel/plugin-transform-numeric-separator"
  ]
};
