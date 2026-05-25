import { useEffect, useRef } from 'react';

import { ChevronDown, FileText, Image as PictureIcon, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AdminExerciseListItem, ExerciseSourceType } from '@/types/situation';

const SOURCE_ICONS: Record<ExerciseSourceType, React.ElementType> = {
  description: FileText,
  dialog: MessageCircle,
  picture: PictureIcon,
};

const SOURCE_TONES: Record<ExerciseSourceType, 'blue' | 'violet' | 'amber'> = {
  description: 'blue',
  dialog: 'violet',
  picture: 'amber',
};

interface AdminExerciseRowProps {
  exercise: AdminExerciseListItem;
  isOpen: boolean;
  onToggle: () => void;
  /** id of the collapsible body region — used for aria-controls */
  rowBodyId: string;
}

export function AdminExerciseRow({ exercise, isOpen, onToggle, rowBodyId }: AdminExerciseRowProps) {
  const { t } = useTranslation('admin');
  const SourceIcon = SOURCE_ICONS[exercise.source_type] ?? FileText;
  const sourceTone = SOURCE_TONES[exercise.source_type] ?? 'blue';

  // EXR-38: return focus to chevron on collapse (keyboard a11y).
  // On expand, we leave focus where it was — auto-focusing into the body would
  // disorient mouse users and is not required for keyboard accessibility.
  const chevronRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(isOpen);

  useEffect(() => {
    if (wasOpen.current && !isOpen && chevronRef.current) {
      chevronRef.current.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  return (
    <div className="flex w-full items-center gap-2 px-4 py-4">
      {/* Title block */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-serif text-[15.5px] leading-tight" lang="el">
          {exercise.situation_title_el}
        </div>
        <div className="text-fg-3 truncate text-[12.5px]">{exercise.situation_title_en}</div>
      </div>

      {/* Badges */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {/* Source badge — per-source tone + icon */}
        <Badge tone={sourceTone}>
          <SourceIcon className="me-1 size-3" aria-hidden />
          <span className="hidden sm:inline">
            {t(`exercises.filters.source.${exercise.source_type}`)}
          </span>
        </Badge>

        {/* Type badge — gray tone */}
        <Badge tone="gray">
          <span className="hidden sm:inline">{t(`exercises.types.${exercise.exercise_type}`)}</span>
        </Badge>

        {/* Level badge — violet, only when set */}
        {exercise.audio_level && <Badge tone="violet">{exercise.audio_level}</Badge>}
        {/* TODO: Picture rows may lack audio_level — backend follow-up needed to populate level for picture source exercises */}

        {/* Item count — mono, i18next plural */}
        <span className="text-fg-3 ms-2 font-mono text-[11px]">
          {t('exercises.row.itemCount', { count: exercise.item_count })}
        </span>
      </div>

      {/* Chevron toggle button */}
      <button
        ref={chevronRef}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={rowBodyId}
        data-testid={`admin-exercise-item-${exercise.id}`}
        className={cn(
          'ml-2 inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          isOpen
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'text-fg-3 border-border hover:border-primary/35 hover:text-primary'
        )}
      >
        <ChevronDown
          className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
    </div>
  );
}
