// src/features/words/components/index.ts

export { ConjugationTable } from './ConjugationTable';
export type { ConjugationTableProps } from './ConjugationTable';

export { NounDeclensionTable, AdjectiveDeclensionTable } from './DeclensionTable';
export type { NounDeclensionTableProps, AdjectiveDeclensionTableProps } from './DeclensionTable';

export { ExamplesSection } from './ExamplesSection';
export type { ExamplesSectionProps } from './ExamplesSection';

export { PracticeCard } from '@/components/shared/PracticeCard';
export type { PracticeCardProps } from '@/components/shared/PracticeCard';

export { CardsSummaryBar } from './CardsSummaryBar';
export type { CardsSummaryBarProps } from './CardsSummaryBar';
export { CardTypeGroup } from './CardTypeGroup';
export type { CardTypeGroupProps } from './CardTypeGroup';
export { groupCards } from './cardGrouping';
export type { CardGroupKey, GroupedCards, CardGroupDefinition } from './cardGrouping';
export { MiniFlipCard } from './MiniFlipCard';
export type { MiniFlipCardProps } from './MiniFlipCard';
