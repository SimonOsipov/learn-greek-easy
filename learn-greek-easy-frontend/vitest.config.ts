import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'happy-dom',

    // Global test utilities (no need to import describe, it, expect)
    globals: true,

    // Setup files (run before each test file)
    setupFiles: ['./src/lib/test-setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/lib/test-utils.tsx',
        'src/lib/test-setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'dist/',
        '**/__tests__/**',
        'src/main.tsx',
        'src/App.tsx',
        'src/components/index.ts',
        '**/index.ts',
        'src/services/mockData.ts',
        'src/services/mockDeckData.ts',
        'src/services/mockReviewData.ts',
        'src/services/mockAnalyticsData.ts',
      ],
      // Coverage thresholds (disabled initially - will be enforced as tests are added)
      // Uncomment when adding comprehensive test coverage
      // thresholds: {
      //   lines: 70,
      //   functions: 70,
      //   branches: 70,
      //   statements: 70,
      // },
    },

    // Include/exclude patterns
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'tests/e2e/**', // E2E tests run separately with Playwright
    ],

    // Test timeout (10 seconds)
    testTimeout: 10000,

    // Hook timeouts
    hookTimeout: 10000,

    // Reporter
    reporters: ['default', 'html'],

    // CSS handling (mock CSS imports)
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },

  // Path aliases (match tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
});
