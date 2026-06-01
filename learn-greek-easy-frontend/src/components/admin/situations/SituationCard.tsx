// src/components/admin/situations/SituationCard.tsx

import React from 'react';

import { Edit, Play, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { CompletionPill } from '@/components/ui/completion-pill';
import { buildSrcSet } from '@/lib/imageVariants';
import type { SituationListItem } from '@/types/situation';

import { SITUATION_STATUS_BADGE_CLASSES } from './situationBadges';
import { formatDuration, pickSitTone } from './thumbnails';

// Re-export so tests/callers can still import from SituationCard if they want.
export type { SitTone } from './thumbnails';
export { pickSitTone } from './thumbnails';

export interface SituationCardProps {
  item: SituationListItem;
  onRequestDelete: (item: { id: string; scenario_el: string }) => void;
}

export const SituationCard: React.FC<SituationCardProps> = ({ item, onRequestDelete }) => {
  const { t } = useTranslation('admin');
  const [, setSearchParams] = useSearchParams();

  const tone = pickSitTone(item.id);

  // Single source of truth: write to URL; SituationsTab's URL→store effect opens the drawer.
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
    // Only handle keydowns that originate on the article itself; ignore bubbled
    // events from inner buttons (Edit/Delete) so Enter/Space on those buttons
    // does not also open the drawer.
    if (e.target !== e.currentTarget) return;
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
    onRequestDelete({ id: item.id, scenario_el: item.scenario_el });
  }

  return (
    <article
      className="sit-card"
      role="button"
      tabIndex={0}
      data-testid={`sit-card-${item.id}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Thumbnail */}
      {item.picture_image_url ? (
        <div className="sit-thumb">
          <img
            className="sit-thumb-img"
            src={item.picture_image_url ?? undefined}
            srcSet={buildSrcSet(item.picture_image_variants)}
            sizes="(max-width: 640px) 50vw, 200px"
            alt=""
            width={400}
            height={300}
            loading="lazy"
          />
          <div className="sit-thumb-meta">
            <span className={SITUATION_STATUS_BADGE_CLASSES[item.status]}>
              {t(`situations.status.${item.status}`)}
            </span>
          </div>
          {item.roles && item.roles.length > 0 && (
            <div className="sit-thumb-roles">
              {item.roles.map((role) => (
                <span key={role} className="sit-role-chip">
                  {role}
                </span>
              ))}
            </div>
          )}
          <div className="sit-thumb-foot">
            <span className="sit-thumb-pill">
              {t('situations.card.linesCount', { count: item.dialog_lines_count })}
            </span>
            {item.audio_duration_seconds != null && (
              <span className="sit-thumb-pill">
                <Play size={10} />
                {formatDuration(item.audio_duration_seconds)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className={`sit-thumb sit-thumb-${tone}`}>
          <div className="sit-thumb-meta">
            <span className={SITUATION_STATUS_BADGE_CLASSES[item.status]}>
              {t(`situations.status.${item.status}`)}
            </span>
          </div>
          {item.roles && item.roles.length > 0 && (
            <div className="sit-thumb-roles">
              {item.roles.map((role) => (
                <span key={role} className="sit-role-chip">
                  {role}
                </span>
              ))}
            </div>
          )}
          <div className="sit-thumb-foot">
            <span className="sit-thumb-pill">
              {t('situations.card.linesCount', { count: item.dialog_lines_count })}
            </span>
            {item.audio_duration_seconds != null && (
              <span className="sit-thumb-pill">
                <Play size={10} />
                {formatDuration(item.audio_duration_seconds)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="sit-body">
        <h3 className="sit-title-el" lang="el" title={item.scenario_el}>
          {item.scenario_el}
        </h3>
        <p className="sit-title-en" title={item.scenario_en}>
          {item.scenario_en}
        </p>

        {/* Level badges */}
        {item.levels && item.levels.length > 0 && (
          <div className="sit-levels">
            {item.levels.map((lvl) => (
              <Badge key={lvl} tone="violet">
                {lvl}
              </Badge>
            ))}
          </div>
        )}

        {/* FROM NEWS kicker */}
        {item.source_title_en && (
          <div className="sit-from">
            {t('situations.card.fromNewsLabel')} · {item.source_title_en}
          </div>
        )}

        {/* Completion strip: 5 boolean pills + separator + 3 count pills */}
        <div className="sit-prog-strip">
          {/* Boolean pills */}
          <CompletionPill label={t('situations.completion.dialog')} done={item.has_dialog} />
          <CompletionPill
            label={t('situations.completion.dialogAudio')}
            done={item.has_dialog_audio}
          />
          <CompletionPill
            label={t('situations.completion.description')}
            done={item.has_description}
          />
          <CompletionPill
            label={t('situations.completion.descAudio')}
            done={item.has_description_audio}
          />
          <CompletionPill label={t('situations.completion.picture')} done={item.has_picture} />

          <span className="sit-prog-sep" aria-hidden="true">
            ·
          </span>

          {/* Count pills */}
          <CompletionPill
            label={t('situations.completion.dialogEx')}
            value={
              item.dialog_exercises_count > 0 ? String(item.dialog_exercises_count) : undefined
            }
            done={item.dialog_exercises_count > 0}
          />
          <CompletionPill
            label={t('situations.completion.descEx')}
            value={
              item.description_exercises_count > 0
                ? String(item.description_exercises_count)
                : undefined
            }
            done={item.description_exercises_count > 0}
          />
          <CompletionPill
            label={t('situations.completion.picEx')}
            value={
              item.picture_exercises_count > 0 ? String(item.picture_exercises_count) : undefined
            }
            done={item.picture_exercises_count > 0}
          />
        </div>
      </div>

      {/* Hover-revealed actions */}
      <div className="sit-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label={t('situations.actions.edit')}
          onClick={handleEdit}
        >
          <Edit size={15} />
        </button>
        <button
          type="button"
          className="icon-btn danger"
          aria-label={t('situations.actions.delete')}
          onClick={handleDelete}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
};
