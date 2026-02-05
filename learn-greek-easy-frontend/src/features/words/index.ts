// src/features/words/index.ts

// Components
export {
  ConjugationTable,
  NounDeclensionTable,
  AdjectiveDeclensionTable,
  ExamplesSection,
} from './components';
export type {
  ConjugationTableProps,
  NounDeclensionTableProps,
  AdjectiveDeclensionTableProps,
  ExamplesSectionProps,
} from './components';

// Hooks
export { useWordEntry } from './hooks';
export type { UseWordEntryOptions, UseWordEntryResult } from './hooks';

// Pages
export { WordReferencePage } from './pages';
