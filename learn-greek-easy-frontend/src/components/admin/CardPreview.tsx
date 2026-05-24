// src/components/admin/CardPreview.tsx
//
// Compact card preview for the Card Error Review tab (CER-28).
// Renders a narrow snapshot of the reported card so admins can evaluate
// error reports without navigating away.
//
// WORD variant:  article + word + IPA + gender chip + EN/RU/Plural grid
// CULTURE variant: question (EN + optional EL) + 4 lettered options + marked-correct tag
//
// Design intentionally omits: example sentences, audio, declension tables.

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { CardErrorCardSnapshot, CardType } from '@/types/cardError';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CardPreviewProps {
  card: CardErrorCardSnapshot | null;
  cardType: CardType;
  compact?: boolean;
  className?: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function WordPreview({
  content,
  compact,
  className,
}: {
  content: CardErrorCardSnapshot;
  compact: boolean;
  className?: string;
}) {
  const { t } = useTranslation('admin');
  const { article, word, ipa, gender, translation_en, translation_ru, plural } = content;

  return (
    <div className={cn('ce-preview ce-preview-word', compact && 'is-compact', className)}>
      <div className="ce-preview-kicker">
        <span className="ce-dot ce-dot-blue" aria-hidden="true" />
        {t('cardErrors.preview.word.kicker')}
      </div>

      <div className="ce-preview-head">
        {article && (
          <span className="ce-article" lang="el">
            {article}
          </span>
        )}
        <div className="ce-word-stack">
          <span className="ce-word" lang="el">
            {word ?? '—'}
          </span>
          {ipa && <span className="ce-ipa">/{ipa}/</span>}
        </div>
        {gender && <span className={cn('ce-gender', `ce-gender-${gender}`)}>{gender}</span>}
      </div>

      <div className="ce-grid">
        <div className="ce-grid-cell">
          <dt>EN</dt>
          <dd>{translation_en ?? '—'}</dd>
        </div>
        <div className="ce-grid-cell">
          <dt>RU</dt>
          <dd>{translation_ru ?? '—'}</dd>
        </div>
        <div className="ce-grid-cell">
          <dt>Plural</dt>
          <dd lang="el">{plural ?? '—'}</dd>
        </div>
      </div>
    </div>
  );
}

function CulturePreview({
  content,
  compact,
  className,
}: {
  content: CardErrorCardSnapshot;
  compact: boolean;
  className?: string;
}) {
  const { t } = useTranslation('admin');
  const { level, question_en, question_el, options, correct_index } = content;
  const opts = options ?? [];

  return (
    <div className={cn('ce-preview ce-preview-culture', compact && 'is-compact', className)}>
      <div className="ce-preview-kicker">
        <span className="ce-dot ce-dot-violet" aria-hidden="true" />
        {t('cardErrors.preview.culture.kicker')}
        {level && (
          <span className="ce-level-badge" aria-label={`Level ${level}`}>
            {level}
          </span>
        )}
      </div>

      <p className="ce-q-en">{question_en}</p>
      {question_el && (
        <p className="ce-q-el" lang="el">
          {question_el}
        </p>
      )}

      <ol className="ce-opts">
        {opts.slice(0, 4).map((opt, i) => (
          <li key={i} className={cn('ce-opt', i === correct_index && 'is-correct')}>
            <span className="ce-opt-letter" aria-hidden="true">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="ce-opt-text" lang="el">
              {opt}
            </span>
            {i === correct_index && (
              <span className="ce-opt-tag">✓ {t('cardErrors.preview.markedCorrect')}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function CardPreviewFallback({ compact, className }: { compact: boolean; className?: string }) {
  const { t } = useTranslation('admin');
  return (
    <div className={cn('ce-preview ce-preview-fallback', compact && 'is-compact', className)}>
      <span className="ce-preview-kicker" style={{ color: 'unset' }}>
        {t('cardErrors.preview.unavailable')}
      </span>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function CardPreview({ card, cardType, compact = false, className }: CardPreviewProps) {
  if (!card) return <CardPreviewFallback compact={compact} className={className} />;

  if (cardType === 'WORD') {
    // Need at least a word to render
    if (!card.word) return <CardPreviewFallback compact={compact} className={className} />;
    return <WordPreview content={card} compact={compact} className={className} />;
  }

  if (cardType === 'CULTURE') {
    // Need at least a question to render
    if (!card.question_en) return <CardPreviewFallback compact={compact} className={className} />;
    return <CulturePreview content={card} compact={compact} className={className} />;
  }

  return <CardPreviewFallback compact={compact} className={className} />;
}
