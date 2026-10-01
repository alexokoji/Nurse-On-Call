import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The availability tests build long slot grids; the default is plenty.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // See tests/stubs/server-only.ts for why this alias exists.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
