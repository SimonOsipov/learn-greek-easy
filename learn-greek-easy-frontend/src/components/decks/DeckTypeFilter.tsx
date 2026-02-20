import React, { useCallback } from 'react';

import { BookOpen, GraduationCap, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { trackDeckFilterChanged } from '@/lib/analytics';

export type DeckType = 'all' | 'vocabulary' | 'culture';

export interface DeckTypeFilterProps {
  value: DeckType;
  onChange: (type: DeckType) => void;
}

const TYPE_OPTIONS: {
  value: DeckType;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}[] = [
  { value: 'all', icon: Layers, labelKey: 'filters.typeAll' },
  { value: 'vocabulary', icon: GraduationCap, labelKey: 'filters.typeVocabulary' },
  { value: 'culture', icon: BookOpen, labelKey: 'filters.typeCulture' },
];

export const DeckTypeFilter: React.FC<DeckTypeFilterProps> = ({ value, onChange }) => {
  const { t } = useTranslation('deck');

  /**
   * Handle deck type filter change.
   * Tracks analytics event and calls onChange.
   */
  const handleTypeChange = useCallback(
    (newType: DeckType) => {
      if (newType === value) return;

      // Track analytics event
      trackDeckFilterChanged({ filter_type: newType });

      onChange(newType);
    },
    [value, onChange]
  );

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-[3.5rem] text-sm font-medium text-foreground">
        {t('filters.deckType')}
      </span>
      <div className="inline-flex rounded-lg border border-border p-1">
        {TYPE_OPTIONS.map(({ value: optValue, icon: Icon, labelKey }) => (
          <Button
            key={optValue}
            variant={value === optValue ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTypeChange(optValue)}
            className={`gap-1.5 ${value === optValue ? '' : 'text-muted-foreground'}`}
            aria-pressed={value === optValue}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </Button>
        ))}
      </div>
    </div>
  );
};
