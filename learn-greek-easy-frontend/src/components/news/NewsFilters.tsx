import { useTranslation } from 'react-i18next';

import { tDynamic } from '@/i18n/tDynamic';
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
    <div
      className={cn('flex flex-wrap items-center justify-between gap-5', className)}
      data-testid="news-filters"
    >
      {/* Country pills (left) */}
      <div className="flex flex-wrap items-center gap-1.5" data-testid="news-country-filters">
        {/* "All" country pill */}
        <button
          type="button"
          onClick={() => onCountryChange('all')}
          aria-pressed={countryFilter === 'all'}
          className={cn(
            // base pill
            'inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-full border px-4 pr-2 text-[13.5px] font-semibold transition-all duration-200',
            countryFilter === 'all'
              ? 'news-filter-pill-active'
              : 'border-line bg-card text-fg2 hover:border-line-2 hover:text-fg'
          )}
        >
          {t('news.country.all')}
          <span
            className={cn(
              'inline-grid min-w-[22px] place-items-center rounded-full px-1.5 text-[11.5px] font-bold leading-none',
              countryFilter === 'all' ? 'bg-white/20 text-white' : 'bg-bg-2 text-fg3'
            )}
            style={{ height: '22px' }}
          >
            {totalCount}
          </span>
        </button>

        {/* Cyprus / Greece / World pills */}
        {(['cyprus', 'greece', 'world'] as const).map((country) => {
          const isActive = countryFilter === country;
          return (
            <button
              key={country}
              type="button"
              onClick={() => onCountryChange(country)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-full border px-4 pr-2 text-[13.5px] font-semibold transition-all duration-200',
                isActive
                  ? 'news-filter-pill-active'
                  : 'border-line bg-card text-fg2 hover:border-line-2 hover:text-fg'
              )}
            >
              {COUNTRY_CONFIG[country].flag} {tDynamic(t, COUNTRY_CONFIG[country].labelKey)}
              <span
                className={cn(
                  'inline-grid min-w-[22px] place-items-center rounded-full px-1.5 text-[11.5px] font-bold leading-none',
                  isActive ? 'bg-white/20 text-white' : 'bg-bg-2 text-fg3'
                )}
                style={{ height: '22px' }}
              >
                {countryCounts[country]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Separator + difficulty segment (right) */}
      <div className="flex items-center gap-4" data-testid="news-difficulty-selector">
        {/* Visual separator — hidden on narrow screens where the row wraps */}
        <div className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />

        {/* Difficulty label */}
        <span className="whitespace-nowrap text-[13.5px] font-medium text-fg2">
          {t('news.level.difficulty')}
        </span>

        {/* A2 / B1 segment track */}
        <div className="inline-flex gap-[2px] rounded-full border border-line bg-bg-2 p-[3px]">
          {(['a2', 'b1'] as const).map((level) => {
            const isActive = newsLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => onLevelChange(level)}
                aria-pressed={isActive}
                className={cn(
                  'h-[30px] cursor-pointer rounded-full px-4 font-mono text-[12.5px] font-semibold tracking-wide transition-all duration-200',
                  isActive
                    ? 'bg-card text-primary shadow-1 ring-1 ring-line'
                    : 'bg-transparent text-fg2 hover:text-fg'
                )}
              >
                {t(`news.level.${level}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
