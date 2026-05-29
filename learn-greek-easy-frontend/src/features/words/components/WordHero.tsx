// src/features/words/components/WordHero.tsx
//
// DX-09: Radial-panel hero header for WordReferencePage.
// Consumes dx.css (.dx-w-hero*) + atoms from @/features/decks/dx.
//
// Placeholders (both danger/red, per Red-Dot Inventory):
//   R4 — enExtra: absent on WordEntryResponse → placeholder italic gloss + UnwiredDot
//   R3 — WeekHeat: no per-word practice heatmap backend yet → static heat + UnwiredDot
// DonutRing: real data (masteredCards / totalCards) — NO dot.

import { useState } from 'react';

import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ReportErrorButton } from '@/components/card-errors';
import { GenderBadge, PartOfSpeechBadge } from '@/components/review/grammar';
import { SpeakerButton } from '@/components/ui/SpeakerButton';
import { DonutRing, DxSvgDefs, UnwiredDot, WeekHeat } from '@/features/decks/dx';
import '@/features/decks/dx/dx.css';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { WordEntryResponse } from '@/services/wordEntryAPI';
import type { NounGender } from '@/types/grammar';
import type { AudioSpeed } from '@/utils/audioSpeed';

// ── Helpers ──────────────────────────────────────────────────────────────────

const GENDER_ARTICLE_MAP: Record<string, string> = {
  masculine: 'ο',
  feminine: 'η',
  neuter: 'το',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface WordHeroProps {
  wordEntry: WordEntryResponse;
  deckId: string;
  displayTranslation: string;
  article?: string;
  masteredCards: number;
  totalCards: number;
  audioSpeed: AudioSpeed;
  onSpeedChange: (s: AudioSpeed) => void;
  onReportError: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WordHero({
  wordEntry,
  deckId,
  displayTranslation,
  article,
  masteredCards,
  totalCards,
  audioSpeed,
  onSpeedChange,
  onReportError,
}: WordHeroProps) {
  const { t } = useTranslation(['deck', 'review']);

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const partOfSpeech = wordEntry.part_of_speech;
  const grammarData = wordEntry.grammar_data;

  // Gender for GenderBadge (nouns only)
  const gender =
    partOfSpeech === 'noun' && grammarData && 'gender' in grammarData
      ? (grammarData.gender as NounGender)
      : undefined;

  return (
    <>
      {/* SVG gradient defs required by DonutRing */}
      <DxSvgDefs />

      <div className="dx-w-hero" data-testid="word-hero">
        {/* Top nav row */}
        <div className="dx-w-hero-top">
          <Link to={`/decks/${deckId}`} className="dx-w-back" data-testid="back-button">
            <ChevronLeft />
            {t('deck:detail.goBack')}
          </Link>

          <ReportErrorButton onClick={onReportError} data-testid="report-error-button" />
        </div>

        {/* POS + gender tags */}
        <div className="dx-w-tags">
          <PartOfSpeechBadge partOfSpeech={partOfSpeech} />
          {partOfSpeech === 'verb' && grammarData && 'voice' in grammarData && (
            <span className="dx-w-tag is-gender capitalize">
              {t(`review:grammar.verbConjugation.voice.${grammarData.voice as string}`)}
            </span>
          )}
          {gender && <GenderBadge gender={gender} />}
        </div>

        {/* Headline: article + word + audio button */}
        <div className="dx-w-headline">
          {article && (
            <span className="dx-w-article" lang="el" data-testid="word-article">
              {article}
            </span>
          )}
          <span className="dx-w-word" lang="el" data-testid="word-lemma">
            {wordEntry.lemma}
            {wordEntry.audio_url && (
              <span
                className={cn('dx-w-audio', isAudioPlaying && 'is-playing')}
                data-testid="word-audio-wrapper"
              >
                <SpeakerButton
                  audioUrl={wordEntry.audio_url}
                  speed={audioSpeed}
                  className="h-full w-full rounded-[inherit] bg-transparent hover:bg-transparent"
                  onPlayStateChange={setIsAudioPlaying}
                  onPlay={() =>
                    track('word_audio_played', {
                      word_entry_id: wordEntry.id,
                      lemma: wordEntry.lemma,
                      part_of_speech: wordEntry.part_of_speech ?? null,
                      context: 'reference',
                      deck_id: deckId,
                      playback_speed: 1,
                    })
                  }
                />
              </span>
            )}
          </span>
        </div>

        {/* IPA / pronunciation */}
        {wordEntry.pronunciation && (
          <div className="dx-w-ipa" lang="el-Latn" data-testid="word-ipa">
            {wordEntry.pronunciation}
          </div>
        )}

        {/* Primary translation */}
        <div className="dx-w-en" data-testid="word-translation">
          {displayTranslation}
        </div>

        {/* Extra gloss — absent from API → placeholder with R4 UnwiredDot (danger) */}
        <UnwiredDot tone="danger" aria-label={t('deck:dx.unwiredExtraGloss')}>
          <p className="dx-w-en-extra" data-testid="word-en-extra">
            {t('deck:wordReference.extraGlossPlaceholder')}
          </p>
        </UnwiredDot>

        {/* Hero bottom: voice-speed + stats */}
        <div className="dx-w-hero-bottom">
          {/* Voice speed */}
          <div className="dx-w-speed">
            <span className="dx-w-speed-l">{t('deck:wordReference.voiceSpeed')}:</span>
            <div className="dx-w-speed-seg">
              {([1, 0.75] as AudioSpeed[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={cn('dx-w-speed-btn', audioSpeed === s && 'is-active')}
                  onClick={() => onSpeedChange(s)}
                  aria-pressed={audioSpeed === s}
                  data-testid={`speed-btn-${s}`}
                >
                  x{s}
                </button>
              ))}
            </div>
          </div>

          {/* Stats: WeekHeat (R3, placeholder) + DonutRing (real) */}
          <div className="dx-w-hero-stats">
            {/* R3 — per-word practice heatmap not yet in backend */}
            <UnwiredDot tone="danger" aria-label={t('deck:dx.unwiredHeatmap')}>
              <WeekHeat heat={[1, 2, 0, 3, 1, 0, 0]} label={t('deck:dx.weekHeatLabel')} />
            </UnwiredDot>

            {/* Real mastery data — NO UnwiredDot */}
            <DonutRing
              done={masteredCards}
              total={totalCards}
              label={t('deck:dx.donutRingLabel')}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// Re-export article map so WordReferencePage does not duplicate it
export { GENDER_ARTICLE_MAP };
