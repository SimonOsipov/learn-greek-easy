// src/components/admin/situations/SituationCard.tsx

import React from 'react';

import { Edit, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CompletionPill } from '@/components/ui/completion-pill';
import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type { SituationListItem } from '@/types/situation';

import { SITUATION_STATUS_BADGE_CLASSES } from './situationBadges';

export interface SituationCardProps {
  item: SituationListItem;
  onRequestDelete: (item: { id: string; scenario_el: string }) => void;
}

// Deterministic tone: sum of charCodes → mod 6 → palette key.
const SIT_TONES = ['blue', 'amber', 'violet', 'cyan', 'green', 'red'] as const;
export type SitTone = (typeof SIT_TONES)[number];

export function pickSitTone(id: string): SitTone {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return SIT_TONES[sum % SIT_TONES.length];
}

export const SituationCard: React.FC<SituationCardProps> = ({ item, onRequestDelete }) => {
  const { t } = useTranslation('admin');
  const openDrawer = useAdminSituationStore((s) => s.openDrawer);

  const tone = pickSitTone(item.id);

  function handleClick() {
    openDrawer(item.id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDrawer(item.id);
    }
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    openDrawer(item.id);
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
      <div className={`sit-thumb sit-thumb-${tone}`}>
        <div className="sit-thumb-meta">
          <span className={SITUATION_STATUS_BADGE_CLASSES[item.status]}>
            {t(`situations.status.${item.status}`)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="sit-body">
        <h3 className="sit-title-el" lang="el" title={item.scenario_el}>
          {item.scenario_el}
        </h3>
        <p className="sit-title-en" title={item.scenario_en}>
          {item.scenario_en}
        </p>

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
