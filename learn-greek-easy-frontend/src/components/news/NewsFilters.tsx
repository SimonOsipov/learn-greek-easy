import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NewsCountry } from '@/services/adminAPI';
import type { NewsLevel } from '@/utils/newsLevel';

import { COUNTRY_CONFIG } from './countryConfig';

export interface NewsFiltersProps {
  countryFilter: 'all' | NewsCountry;
  onCountryChange: (country: string) => void;
  newsLevel: NewsLevel;
  onLevelChange: (level: NewsLevel) => void;
  countryCounts: { cyprus: number; greece: number; world: number };
  className?: string;
}

export function NewsFilters({
  countryFilter,
  onCountryChange,
  newsLevel,
  onLevelChange,
  countryCounts,
  className,
}: NewsFiltersProps) {
  const { t } = useTranslation('common');

  const totalCount = countryCounts.cyprus + countryCounts.greece + countryCounts.world;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} data-testid="news-filters">
      <div className="flex flex-wrap items-center gap-2" data-testid="news-country-filters">
        {/* "All" country button */}
        <Button
          variant={countryFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onCountryChange('all')}
          className="gap-1.5 rounded-full"
          aria-pressed={countryFilter === 'all'}
        >
          {t('news.country.all')}
          <Badge variant="secondary" className="ml-1 min-w-[1.25rem] px-1.5">
            {totalCount}
          </Badge>
        </Button>

        {/* Country buttons */}
        {(['cyprus', 'greece', 'world'] as const).map((country) => (
          <Button
            key={country}
            variant={countryFilter === country ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCountryChange(country)}
            className="gap-1.5 rounded-full"
            aria-pressed={countryFilter === country}
          >
            {COUNTRY_CONFIG[country].flag} {t(COUNTRY_CONFIG[country].labelKey)}
            <Badge variant="secondary" className="ml-1 min-w-[1.25rem] px-1.5">
              {countryCounts[country]}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border" aria-hidden="true" />

      <div className="flex items-center gap-2" data-testid="news-difficulty-selector">
        {/* Difficulty label */}
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {t('news.level.difficulty')}
        </span>

        {/* Level buttons */}
        <Button
          variant={newsLevel === 'a2' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onLevelChange('a2')}
          className="rounded-full"
          aria-pressed={newsLevel === 'a2'}
        >
          {t('news.level.a2')}
        </Button>
        <Button
          variant={newsLevel === 'b2' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onLevelChange('b2')}
          className="rounded-full"
          aria-pressed={newsLevel === 'b2'}
        >
          {t('news.level.b2')}
        </Button>
      </div>
    </div>
  );
}
