// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  {
    // dist/ = Expo build output; src/**/*.js = compiled TypeScript artefacts
    // (tsc --outDir or Metro cache) that shadow the .tsx sources — not source files.
    ignores: ["dist/*", "src/**/*.js"],
  },
  // Provide Jest globals for all test files so jest.fn(), describe, it, etc.
  // are recognised — required for both .tsx and any compiled .js test artefacts.
  {
    files: ["**/__tests__/**/*", "**/*.test.*", "**/*.spec.*"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
]);
