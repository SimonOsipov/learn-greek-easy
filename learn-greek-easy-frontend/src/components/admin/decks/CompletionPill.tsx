// src/components/admin/decks/CompletionPill.tsx
//
// Atom component for rendering a single deck completion pill.
// Used by VocabDrawerBody (DKDR-10) and CultureDrawerBody (DKDR-12).
// CSS classes .dk-pill, .dk-pill.is-done, .dk-pill.is-todo are defined
// in src/index.css (ported in ADMIN2-01).

import type { DeckPill } from '@/lib/deckCompletion';
import { cn } from '@/lib/utils';

interface CompletionPillProps {
  pill: DeckPill;
}

export function CompletionPill({ pill }: CompletionPillProps) {
  return (
    <span
      className={cn('dk-pill', pill.done ? 'is-done' : 'is-todo')}
      title={pill.tooltip}
      data-testid={`completion-pill-${pill.name}`}
    >
      {pill.label}
    </span>
  );
}
