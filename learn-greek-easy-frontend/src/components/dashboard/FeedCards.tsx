// src/components/dashboard/FeedCards.tsx
// 8 typed feed card components + dispatch.
// Mirrors cd-source/dashboard.jsx FeedHeroResume … FeedQuick.
// Plain .btn/.icon-btn (not shadcn Button) to avoid Tailwind cascade-trap.

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { COUNTRY_CONFIG } from '@/components/news';
import { situationToCoverProps } from '@/components/situations/situationToCoverProps';
import { UnwiredDot } from '@/features/decks/dx';
import { tDynamic } from '@/i18n/tDynamic';
import { track } from '@/lib/analytics';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { formatPublicationDate, safeExternalHref } from '@/utils/newsFormat';

import type { FeedItem } from './lib/composeFeed';

// ─── Shared SVG icons (matched to CD dashboard.jsx DI) ───────────────────────

const ArrowR = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ width: 14, height: 14, flexShrink: 0 }}
  >
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 10, height: 10 }}>
    <path d="M6 4l14 8-14 8z" />
  </svg>
);
const FlameIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 22, height: 22 }}>
    <path d="M12 2c1 4 4 5 4 9a4 4 0 1 1-8 0c0-1 .3-2 1-3 0 2 2 2 2 1 0-2-1-3-1-5 0-1 .8-2 2-2zM7 14a5 5 0 0 0 10 0c0 3-2 7-5 8-3-1-5-5-5-8z" />
  </svg>
);
const BoltIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}>
    <path d="m13 2-9 12h6l-2 8 9-12h-6z" />
  </svg>
);

// ─── Props shared by all cards ────────────────────────────────────────────────

interface CardHandlers {
  onOpenDeck: (deckId: string) => void;
  onStartReview: () => void;
  onStartQuick: () => void;
}

// ─── 1. Hero resume card ──────────────────────────────────────────────────────

function FeedHeroResume({
  item,
  onOpenDeck,
}: {
  item: Extract<FeedItem, { type: 'resume' }>;
  onOpenDeck: (id: string) => void;
}) {
  const { t, i18n } = useTranslation('common');
  const deck = item.deck;
  const name = getLocalizedDeckName(deck, i18n.language);
  const progress = deck.progress;
  const pct =
    progress && progress.cardsTotal > 0
      ? Math.round(((progress.cardsLearning + progress.cardsMastered) / progress.cardsTotal) * 100)
      : 0;

  return (
    <article className="db-card is-resume span-hero" data-tone={item.tone}>
      <div className="db-resume-grid">
        <div className="db-resume-l">
          <div className="db-card-head">
            <span className="db-card-kicker">{t('dashboard.feed.resume.kicker')}</span>
            <span className="db-card-type" data-kind="deck">
              {t('dashboard.feed.resume.typeBadge')}
            </span>
          </div>
          <h2 className="db-resume-h">{name}</h2>
          {deck.titleGreek && (
            <p className="db-resume-h-el" lang="el">
              {deck.titleGreek}
            </p>
          )}
          <div className="db-resume-stats">
            <div className="db-resume-stat">
              <b>{progress?.dueToday ?? 0}</b>
              <span>{t('dashboard.feed.resume.dueNow')}</span>
            </div>
            <div className="db-resume-stat">
              <b>{progress?.cardsMastered ?? 0}</b>
              <span>{t('dashboard.feed.resume.ofMastered', { total: deck.cardCount })}</span>
            </div>
            <div className="db-resume-stat">
              <b>{pct}%</b>
              <span>{t('dashboard.feed.resume.complete')}</span>
            </div>
          </div>
          <div className="db-resume-actions">
            <button className="btn btn-primary" onClick={() => onOpenDeck(deck.id)}>
              {t('dashboard.feed.resume.cta')} <ArrowR />
            </button>
          </div>
        </div>
        {/* Deck-cover stack — decorative illustration from CD */}
        <div className="db-resume-r">
          <div className="db-cover db-cover-1">
            <span className="db-cover-tag">
              {deck.level} · {deck.category}
            </span>
            <div className="db-cover-title">{name}</div>
          </div>
          <div className="db-cover db-cover-2">
            <span className="db-cover-tag">
              {deck.level} · {deck.category}
            </span>
            <div className="db-cover-title">{name}</div>
          </div>
          <div className="db-cover db-cover-3">
            <span className="db-cover-tag">
              {deck.level} · {deck.category}
            </span>
            <div className="db-cover-title">{name}</div>
            {deck.titleGreek && (
              <div className="db-cover-el" lang="el">
                {deck.titleGreek}
              </div>
            )}
            <div className="db-cover-foot">
              <span className="db-cover-pct">{pct}%</span>
              <span className="db-cover-bar">
                <span style={{ width: `${pct}%` }} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── 2. Review card ───────────────────────────────────────────────────────────

function FeedReview({
  item,
  onStartReview,
}: {
  item: Extract<FeedItem, { type: 'review' }>;
  onStartReview: () => void;
}) {
  const { t, i18n } = useTranslation('common');
  return (
    <article className="db-card is-review span-side" data-tone={item.tone}>
      <div className="db-card-head">
        <span className="db-card-kicker">{t('dashboard.feed.review.kicker')}</span>
        <span className="db-card-type" data-kind="review">
          {t('dashboard.feed.review.typeBadge')}
        </span>
      </div>
      <h3 className="db-card-h">
        {t('dashboard.feed.review.title', {
          count: item.cardsDue,
          decks: item.dueDecks.length,
        })}
      </h3>
      <div className="db-review-list">
        {item.dueDecks.map((deck) => (
          <div key={deck.id} className="db-review-row">
            <span className="db-review-dot" />
            <b>{getLocalizedDeckName(deck, i18n.language)}</b>
            <span>
              · {t('dashboard.feed.review.cardsCount', { count: deck.progress?.dueToday ?? 0 })}
            </span>
          </div>
        ))}
      </div>
      <button className="btn btn-glass btn-sm" onClick={onStartReview}>
        {t('dashboard.feed.review.cta')} <ArrowR />
      </button>
    </article>
  );
}

// ─── 3. News card ─────────────────────────────────────────────────────────────

function FeedNews({ item }: { item: Extract<FeedItem, { type: 'news' }> }) {
  const { t, i18n } = useTranslation('common');
  const news = item.news;
  const country = news.country as keyof typeof COUNTRY_CONFIG | undefined;
  const countryConf = country && COUNTRY_CONFIG[country];
  const href = safeExternalHref(news.original_article_url);
  const localizedTitle =
    i18n.language === 'ru' ? (news.title_ru ?? news.title_el) : (news.title_en ?? news.title_el);
  const date = formatPublicationDate(news.publication_date, i18n.language);
  const audioDuration = news.audio_duration_seconds
    ? `${Math.floor(news.audio_duration_seconds / 60)}:${String(news.audio_duration_seconds % 60).padStart(2, '0')}`
    : null;
  const bg = news.image_url
    ? `url('${news.image_url}')`
    : 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--primary)))';

  const handleClick = () => {
    if (!href) return;
    track('news_article_clicked', {
      news_id: news.id,
      country: news.country,
      source: 'dashboard_feed',
    });
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <article
      className="db-card is-news span-compact"
      data-tone={item.tone}
      onClick={handleClick}
      style={{ cursor: href ? 'pointer' : 'default' }}
    >
      <div className="db-news-grid">
        <div className="db-news-img" style={{ backgroundImage: bg }}>
          {countryConf && (
            <span className="db-news-flag">
              {countryConf.flag} {tDynamic(t, countryConf.labelKey)}
            </span>
          )}
          {date && <span className="db-news-date">{date}</span>}
        </div>
        <div className="db-news-body">
          <div className="db-card-head">
            <span className="db-card-kicker">
              {countryConf
                ? t('dashboard.feed.news.kickerWithCountry', {
                    country: tDynamic(t, countryConf.labelKey),
                  })
                : t('dashboard.feed.news.kicker')}
            </span>
            <span className="db-card-type" data-kind="news">
              {t('dashboard.feed.news.typeBadge')}
            </span>
          </div>
          {/* Greek title primary (is-greek), localized subtitle */}
          <h3 className="db-card-h is-greek" lang="el">
            {news.title_el}
          </h3>
          {localizedTitle && localizedTitle !== news.title_el && (
            <p className="db-card-h-en">{localizedTitle}</p>
          )}
          <div className="db-card-foot">
            <div className="db-card-foot-l">
              {/* D-NEWS-LEVEL: per-item CEFR level chip omitted — news items carry no level field */}
              {audioDuration && (
                <span className="db-audio-pill">
                  <PlayIcon /> {audioDuration}
                </span>
              )}
              <span className="dot">·</span>
              <span>{t('dashboard.feed.news.readPractice')}</span>
            </div>
            <button
              className="icon-btn icon-btn-sm"
              title={t('dashboard.feed.news.readPractice')}
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              aria-label={t('dashboard.feed.news.readPractice')}
            >
              <ArrowR />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── 4. Situation card ────────────────────────────────────────────────────────

function FeedSituation({ item }: { item: Extract<FeedItem, { type: 'situation' }> }) {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const sit = item.situation;
  const localizedTitle =
    i18n.language === 'ru'
      ? (sit.scenario_ru ?? sit.scenario_el)
      : (sit.scenario_en ?? sit.scenario_el);
  const coverProps = situationToCoverProps(sit);
  // D-SIT: synthetic level from domain map (not true CEFR — backend doesn't send it on learner list)
  const level = coverProps.level;

  return (
    <article
      className="db-card is-situation span-compact"
      data-tone={item.tone}
      onClick={() => navigate(`/situations/${sit.id}`)}
    >
      <div className="db-card-head">
        <span className="db-card-kicker">{sit.domain ?? t('dashboard.feed.situation.kicker')}</span>
        <span className="db-card-type" data-kind="situation">
          {t('dashboard.feed.situation.typeBadge')}
        </span>
      </div>
      <h3 className="db-card-h" lang="el">
        {sit.scenario_el}
      </h3>
      {localizedTitle && localizedTitle !== sit.scenario_el && (
        <p className="db-card-h-en">{localizedTitle}</p>
      )}
      {/* D-SIT: .db-sit-roles chips omitted — roles are admin-only, not in learner list payload */}
      <div className="db-card-foot">
        <div className="db-card-foot-l">
          <span className="news-level">{level}</span>
          <span className="dot">·</span>
          <span>{t('dashboard.feed.situation.exercises', { count: sit.exercise_total })}</span>
        </div>
        <button
          className="icon-btn icon-btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/situations/${sit.id}`);
          }}
          aria-label={t('dashboard.feed.situation.typeBadge')}
        >
          <ArrowR />
        </button>
      </div>
    </article>
  );
}

// ─── 5. Word of the day card ──────────────────────────────────────────────────

function FeedWord({ item }: { item: Extract<FeedItem, { type: 'wordOfDay' }> }) {
  const { t } = useTranslation('common');
  return (
    <article className="db-card is-word span-compact" data-tone={item.tone}>
      <div className="db-card-head">
        <span className="db-card-kicker">{t('dashboard.feed.word.kicker')}</span>
        <span className="db-card-type" data-kind="word">
          {t('dashboard.feed.word.typeBadge')}
        </span>
      </div>
      {/* D-WOTD: word value wrapped in UnwiredDot (no backend source yet) */}
      <div>
        <UnwiredDot tone="danger" aria-label={t('dashboard.feed.word.unwiredAria')}>
          <h3 className="db-word-h" lang="el">
            —
          </h3>
        </UnwiredDot>
        {/* D-WORD-MINIMAL: example + Listen/Add-to-deck omitted (no word to act on) */}
      </div>
    </article>
  );
}

// ─── 6. Deck card ────────────────────────────────────────────────────────────

const ILLO_MARK: Record<string, string> = {
  verbs: 'ρή',
  culture: 'Κ',
  deck: 'Ελ',
};

function FeedDeck({
  item,
  onOpenDeck,
}: {
  item: Extract<FeedItem, { type: 'deck' }>;
  onOpenDeck: (id: string) => void;
}) {
  const { t, i18n } = useTranslation('common');
  const deck = item.deck;
  const name = getLocalizedDeckName(deck, i18n.language);
  const progress = deck.progress;
  const pct =
    progress && progress.cardsTotal > 0
      ? Math.round(((progress.cardsLearning + progress.cardsMastered) / progress.cardsTotal) * 100)
      : 0;

  return (
    <article className="db-card is-deck span-side" data-tone={item.tone} data-illo={item.illo}>
      <div className="db-deck-illo">
        <span className="db-deck-illo-mark" lang="el">
          {ILLO_MARK[item.illo] ?? 'Ελ'}
        </span>
      </div>
      <div className="db-card-head">
        <span className="db-card-kicker">{t('dashboard.feed.deck.kicker')}</span>
        <span className="db-card-type" data-kind="deck">
          {t('dashboard.feed.deck.typeBadge')}
        </span>
      </div>
      <h3 className="db-card-h">{name}</h3>
      <div className="db-deck-progress-row">
        <div className="db-deck-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <span>{pct}%</span>
      </div>
      <div className="db-card-foot">
        <div className="db-card-foot-l">
          <span>
            <b style={{ color: 'hsl(var(--fg))' }}>{progress?.dueToday ?? 0}</b>{' '}
            {t('dashboard.feed.deck.meta', {
              due: '',
              mastered: progress?.cardsMastered ?? 0,
            }).replace('{{due}} ', '')}
          </span>
        </div>
        <button className="btn btn-glass btn-sm" onClick={() => onOpenDeck(deck.id)}>
          {t('dashboard.feed.deck.cta')} <ArrowR />
        </button>
      </div>
    </article>
  );
}

// ─── 7. Milestone / streak card ───────────────────────────────────────────────

function FeedMilestone({
  item,
  onStartReview,
}: {
  item: Extract<FeedItem, { type: 'milestone' }>;
  onStartReview: () => void;
}) {
  const { t } = useTranslation('common');
  const { currentStreak, longestStreak } = item;
  const sub =
    currentStreak < longestStreak
      ? t('dashboard.feed.milestone.beatBest', {
          count: longestStreak - currentStreak,
          best: longestStreak,
        })
      : t('dashboard.feed.milestone.personalBest');

  return (
    <article className="db-card is-milestone span-compact" data-tone={item.tone}>
      <div className="db-card-head">
        <span className="db-card-kicker">{t('dashboard.feed.milestone.kicker')}</span>
        <span className="db-card-type" data-kind="milestone">
          {t('dashboard.feed.milestone.typeBadge')}
        </span>
      </div>
      <div className="db-streak-flame">
        <FlameIcon />
      </div>
      <div>
        <div className="db-streak-h">
          {currentStreak}{' '}
          <small>
            {t('dashboard.feed.milestone.title', { count: currentStreak }).replace(
              String(currentStreak) + ' ',
              ''
            )}
          </small>
        </div>
        <p className="db-card-sub">{sub}</p>
      </div>
      {/* D-MILESTONE-NOFOOTER: day-letter footer omitted (would fabricate which days were studied) */}
      <div className="db-card-foot">
        <div className="db-card-foot-l" />
        <button className="btn btn-glass btn-sm" onClick={onStartReview}>
          {t('dashboard.feed.milestone.cta')} <ArrowR />
        </button>
      </div>
    </article>
  );
}

// ─── 8. Quick-practice card ───────────────────────────────────────────────────

function FeedQuick({
  item,
  onStartQuick,
}: {
  item: Extract<FeedItem, { type: 'quick' }>;
  onStartQuick: () => void;
}) {
  const { t } = useTranslation('common');
  return (
    <article className="db-card is-quick span-compact" data-tone={item.tone}>
      <div className="db-card-head">
        <span className="db-card-kicker">{t('dashboard.feed.quick.kicker')}</span>
        <span className="db-card-type" data-kind="quick">
          {t('dashboard.feed.quick.typeBadge')}
        </span>
      </div>
      <div className="db-quick-mark">
        <BoltIcon />
      </div>
      <h3 className="db-card-h">{t('dashboard.feed.quick.meta', { count: item.queueCount })}</h3>
      {/* D-QUICK-SIMPLE: "word order" type detail omitted (not in exercise queue payload) */}
      <div className="db-card-foot">
        <div className="db-card-foot-l" />
        <button className="btn btn-glass btn-sm" onClick={onStartQuick}>
          {t('dashboard.feed.quick.cta')} <ArrowR />
        </button>
      </div>
    </article>
  );
}

// ─── FeedCard dispatch ────────────────────────────────────────────────────────

export interface FeedCardProps extends CardHandlers {
  item: FeedItem;
}

export function FeedCard({ item, onOpenDeck, onStartReview, onStartQuick }: FeedCardProps) {
  switch (item.type) {
    case 'resume':
      return <FeedHeroResume item={item} onOpenDeck={onOpenDeck} />;
    case 'review':
      return <FeedReview item={item} onStartReview={onStartReview} />;
    case 'news':
      return <FeedNews item={item} />;
    case 'situation':
      return <FeedSituation item={item} />;
    case 'wordOfDay':
      return <FeedWord item={item} />;
    case 'deck':
      return <FeedDeck item={item} onOpenDeck={onOpenDeck} />;
    case 'milestone':
      return <FeedMilestone item={item} onStartReview={onStartReview} />;
    case 'quick':
      return <FeedQuick item={item} onStartQuick={onStartQuick} />;
    default:
      return null;
  }
}
