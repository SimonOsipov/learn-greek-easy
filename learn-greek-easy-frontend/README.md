# Learn Greek Easy - Frontend

[![Test Coverage](https://img.shields.io/badge/coverage-72.5%25-brightgreen)](./docs/test-coverage-report.md)
[![Tests](https://img.shields.io/badge/tests-2022%20passing-brightgreen)](./docs/testing-guide.md)
[![WCAG 2.1 AA](https://img.shields.io/badge/WCAG-2.1%20AA-green)](https://www.w3.org/WAI/WCAG21/quickref/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-blue)](https://react.dev/)

A React + TypeScript + Vite application for learning Greek language with spaced repetition flashcards.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Testing

This project uses Vitest + React Testing Library for unit/integration tests and Playwright for E2E tests.

### Unit & Integration Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Open Vitest UI (browser-based test runner)
npm run test:ui

# Generate coverage report
npm run test:coverage

# Watch mode with coverage
npm run test:coverage:watch

# Run only changed tests
npm run test:changed
```

### E2E Tests (Playwright)

```bash
# Run E2E tests
npm run test:e2e

# Open Playwright UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed

# Debug E2E tests
npm run test:e2e:debug
```

### Test Coverage

- **Coverage**: 72.5% (Target: 70%+ ✅)
- **Unit Tests**: 1,432 tests
- **Integration Tests**: 412 tests
- **E2E Tests**: 178 tests
- **Total**: 2,022 tests

**Coverage by Directory**:
- Utils: 91.5% ✅ (Target: 90%+)
- Hooks: 86.4% ✅ (Target: 85%+)
- Stores: 81.1% ✅ (Target: 80%+)
- Components: 65.2% ✅ (Target: 60%+)

**Accessibility**: WCAG 2.1 AA compliant (0 violations)
**Mobile**: Tested at 375px, 768px, 1024px
**Keyboard**: Full keyboard navigation support

See [docs/testing-guide.md](./docs/testing-guide.md) for detailed testing patterns and [docs/test-coverage-report.md](./docs/test-coverage-report.md) for full coverage report.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
