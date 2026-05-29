import { LayoutGrid, LayoutList } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export type CardsView = 'grid' | 'list';

export interface CardsViewToggleProps {
  value: CardsView;
  onChange: (v: CardsView) => void;
}

/**
 * CardsViewToggle — in-screen segmented toggle for grid / list card views.
 * Renders two buttons inside a pill track, matching the dx-w-speed-seg pattern.
 */
export function CardsViewToggle({ value, onChange }: CardsViewToggleProps) {
  const { t } = useTranslation('deck');

  return (
    <div
      className="dx-w-speed-seg"
      role="group"
      aria-label={t('wordReference.cardsViewToggleLabel', { defaultValue: 'Cards view' })}
      data-testid="cards-view-toggle"
    >
      <button
        type="button"
        className={cn('dx-w-speed-btn', value === 'grid' && 'is-active')}
        onClick={() => onChange('grid')}
        aria-pressed={value === 'grid'}
        aria-label={t('wordReference.cardsViewGrid', { defaultValue: 'Grid view' })}
        data-testid="cards-view-grid-btn"
      >
        <LayoutGrid className="h-3 w-3" />
      </button>
      <button
        type="button"
        className={cn('dx-w-speed-btn', value === 'list' && 'is-active')}
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
        aria-label={t('wordReference.cardsViewList', { defaultValue: 'List view' })}
        data-testid="cards-view-list-btn"
      >
        <LayoutList className="h-3 w-3" />
      </button>
    </div>
  );
}
