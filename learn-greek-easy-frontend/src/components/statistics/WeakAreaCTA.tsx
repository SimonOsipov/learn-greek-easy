import React from 'react';

import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { getWeakestCategory } from '@/lib/cultureReadinessUtils';
import type { CategoryReadiness } from '@/services/cultureDeckAPI';

export interface WeakAreaCTAProps {
  categories: CategoryReadiness[];
  isLoading: boolean;
}

export function WeakAreaCTA({ categories, isLoading }: WeakAreaCTAProps) {
  const { t } = useTranslation('statistics');
  const navigate = useNavigate();
  const { track } = useTrackEvent();

  const result = getWeakestCategory(categories);

  if (result === null) return null;
  if (isLoading) return <Skeleton className="h-11 w-full" />;

  const target = result.category;
  const translatedName = t(`cultureReadiness.categoryBreakdown.categories.${target.category}`);
  const percentage = Math.round(target.readiness_percentage);

  const handleClick = () => {
    track('culture_weak_area_cta_clicked', {
      target_category: target.category,
      readiness_percentage: target.readiness_percentage,
      questions_mastered: target.questions_mastered,
      questions_total: target.questions_total,
      new_questions: target.questions_total - target.questions_mastered,
      target_deck_id: target.deck_ids[0] ?? '',
      was_tie_broken: result.wasTieBroken,
    });
    if (target.deck_ids.length > 0) {
      navigate(`/culture/${target.deck_ids[0]}/practice`);
    }
  };

  return (
    <Button
      variant="default"
      size="lg"
      className="w-full sm:w-auto"
      disabled={target.deck_ids.length === 0}
      onClick={handleClick}
      aria-label={t('cultureReadiness.studyWeakest.ariaLabel', {
        category: translatedName,
        percentage,
      })}
    >
      <Play size={18} className="mr-2" />
      {t('cultureReadiness.studyWeakest.button', {
        category: translatedName,
        percentage,
      })}
    </Button>
  );
}
