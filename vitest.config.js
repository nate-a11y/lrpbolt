/* Proprietary and confidential. See LICENSE. */
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { src: path.resolve(__dirname, "src") } },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.js"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage"
    }
  }
});
