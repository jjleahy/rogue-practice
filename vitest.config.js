import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'jsdom',
    include: ['**/*.test.js','**/*.test.mjs'],
  },
});
