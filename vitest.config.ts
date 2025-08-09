// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',        // or 'jsdom' if you test DOM stuff
    globals: true,              // <-- gives you describe/test/expect globally
    include: ['tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: { enabled: false }
  }
});
