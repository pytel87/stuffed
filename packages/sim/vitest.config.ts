import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Whole bot matches take a few seconds each, longer while other test files run alongside.
    testTimeout: 20_000,
  },
});
