import React from 'react';

import { BookOpen, GraduationCap, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

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

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('filters.deckType')}
      </span>
      <div className="inline-flex rounded-lg border border-gray-200 p-1 dark:border-gray-700">
        {TYPE_OPTIONS.map(({ value: optValue, icon: Icon, labelKey }) => (
          <Button
            key={optValue}
            variant={value === optValue ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange(optValue)}
            className={`gap-1.5 ${value === optValue ? '' : 'text-gray-600 dark:text-gray-400'}`}
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
