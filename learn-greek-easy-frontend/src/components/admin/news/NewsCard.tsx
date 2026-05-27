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

  const hasB2 = item.description_el != null && item.description_el !== '';
  const hasA2 = item.description_el_a2 != null && item.description_el_a2 !== '';

  const totalAudio = (item.audio_duration_seconds ?? 0) + (item.audio_a2_duration_seconds ?? 0);
  const hasAudio = item.audio_duration_seconds != null || item.audio_a2_duration_seconds != null;

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
        <span className="news-thumb-flag">{flag}</span>
        <span className="news-thumb-date">{formattedDate}</span>
      </div>

      {/* Column 2 — Body */}
      <div className="news-body">
        <h3 className="news-title" title={title ?? ''}>
          {title}
        </h3>

        <div className="news-meta">
          {/* Level pills — using .news-level mono utility */}
          {(hasB2 || hasA2) && (
            <span className="news-levels">
              {hasB2 && <span className="news-level">B2</span>}
              {hasA2 && <span className="news-level">A2</span>}
            </span>
          )}

          {/* Audio duration */}
          {hasAudio && (
            <span className="news-audio">
              <Play size={11} />
              {formatDuration(totalAudio)}
            </span>
          )}

          {/* Middle dot separator */}
          {(hasB2 || hasA2 || hasAudio) && <span aria-hidden="true">·</span>}

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
