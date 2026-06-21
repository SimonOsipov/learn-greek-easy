// src/components/admin/news/NewsCard.tsx

import React from 'react';

import { format } from 'date-fns';
import { Edit, Play, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import type { NewsItemResponse } from '@/services/adminAPI';

import { pickNewsThumb } from './newsThumbs';

const COUNTRY_FLAG: Record<string, string> = {
  cyprus: '🇨🇾',
  greece: '🇬🇷',
  world: '🌍',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface NewsCardProps {
  item: NewsItemResponse;
  onRequestDelete: (id: string) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({ item, onRequestDelete }) => {
  const { t, i18n } = useTranslation('admin');
  const [, setSearchParams] = useSearchParams();

  const lang = i18n.language;
  const title =
    lang === 'el'
      ? (item.title_el ?? item.title_en)
      : lang === 'ru'
        ? (item.title_ru ?? item.title_en)
        : (item.title_en ?? item.title_el);

  const formattedDate = format(new Date(item.publication_date), 'dd MMM yyyy');
  const flag = COUNTRY_FLAG[item.country] ?? '🌍';

  const hasB1 = item.description_el != null && item.description_el !== '';
  const hasA2 = item.description_el_a2 != null && item.description_el_a2 !== '';

  // F7: render each level's audio duration separately (never their sum). A track
  // with no duration OR a stored 0-second duration is suppressed (never "0:00").
  const b1Audio = item.audio_duration_seconds;
  const a2Audio = item.audio_a2_duration_seconds;
  const hasB1Audio = (b1Audio ?? 0) > 0;
  const hasA2Audio = (a2Audio ?? 0) > 0;
  const hasAudio = hasB1Audio || hasA2Audio;

  // Single source of truth: write to URL; NewsTab's URL→store effect opens the drawer.
  function openViaUrl() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('edit', item.id);
        return next;
      },
      { replace: false }
    );
  }

  function handleClick() {
    openViaUrl();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openViaUrl();
    }
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    openViaUrl();
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    onRequestDelete(item.id);
  }

  return (
    <article
      className="news-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Column 1 — Thumbnail (96×72px fixed) */}
      <div className="news-thumb">
        {item.image_url ? (
          <img src={item.image_url} alt={title ?? ''} />
        ) : (
          <div className="news-thumb-fallback" style={{ background: pickNewsThumb(item.id) }} />
        )}
        <span className="news-thumb-date">{formattedDate}</span>
      </div>

      {/* Column 2 — Body */}
      <div className="news-body">
        <h3 className="news-title" title={title ?? ''}>
          {title}
        </h3>

        <div className="news-meta">
          {/* F4 — Country flag moved into meta row (before level pills) */}
          <span className="news-meta-flag">{flag}</span>

          {/* F5 — Publish-status dot: amber=draft, green=published */}
          <span
            className={
              item.status === 'published'
                ? 'news-status-dot bg-success'
                : 'news-status-dot bg-warning'
            }
            role="img"
            aria-label={t(
              item.status === 'published' ? 'news.card.statusPublished' : 'news.card.statusDraft'
            )}
            title={t(
              item.status === 'published' ? 'news.card.statusPublished' : 'news.card.statusDraft'
            )}
          />

          {/* Level pills — using .news-level mono utility */}
          {(hasB1 || hasA2) && (
            <span className="news-levels">
              {hasB1 && <span className="news-level">B1</span>}
              {hasA2 && <span className="news-level">A2</span>}
            </span>
          )}

          {/* Audio duration — one indicator per level (B1 / A2), never summed.
              B1/A2 are level codes, rendered literally (not translatable copy).
              The label is a plain text prefix (not a .news-level pill, which is
              reserved for the description-level chips above). */}
          {hasB1Audio && (
            <span className="news-audio">
              <Play size={11} />
              B1 {formatDuration(b1Audio as number)}
            </span>
          )}
          {hasA2Audio && (
            <span className="news-audio">
              <Play size={11} />
              A2 {formatDuration(a2Audio as number)}
            </span>
          )}

          {/* Middle dot separator */}
          {(hasB1 || hasA2 || hasAudio) && <span aria-hidden="true">·</span>}

          {/* Published date */}
          <span className="news-pub">
            {t('news.card.publishedLabel')} {formattedDate}
          </span>
        </div>
      </div>

      {/* Column 3 — Hover-revealed actions */}
      <div className="news-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label={t('news.card.editLabel')}
          onClick={handleEdit}
        >
          <Edit size={15} />
        </button>
        <button
          type="button"
          className="icon-btn danger"
          aria-label={t('news.card.deleteLabel')}
          onClick={handleDelete}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
};
