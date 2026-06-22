import React from 'react';

import { Play, Wand2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { tDynamic } from '@/i18n/tDynamic';
import { buildSrcSet, recoverDerivativeError } from '@/lib/imageVariants';
import type { NewsItemResponse } from '@/services/adminAPI';

// Country code → flag emoji lookup (ISO 3166-1 alpha-2 and common backend string values).
const COUNTRY_FLAGS: Record<string, string> = {
  GR: '🇬🇷',
  gr: '🇬🇷',
  greece: '🇬🇷',
  CY: '🇨🇾',
  cy: '🇨🇾',
  cyprus: '🇨🇾',
  ES: '🇪🇸',
  es: '🇪🇸',
  spain: '🇪🇸',
};

export function countryToFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? '🌍';
}

function formatDurationMSS(seconds: number): string {
  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = String(totalSecs % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

// Future MVP+: this prop is wired but never non-null until backend ships the filter.
export interface LinkedSituationSummary {
  id: string;
  titleEn: string;
  titleEl: string;
  status: string;
  levels: string[];
  country: string;
  // counts and meta:
  roleCount: number;
  names: string;
  turnCount: number;
  exerciseCount: number;
  audioDurationSeconds: number;
  // picture fields (F4 ADMIN2-41):
  pictureImageUrl: string | null;
  pictureImageVariants: Record<number, string> | null;
  hasPicture: boolean;
}

interface Props {
  item: NewsItemResponse;
  linkedSituation?: LinkedSituationSummary | null;
  onRequestQuickJump?: (situationId: string) => void;
}

export const NewsEditDrawerLinkedSituation: React.FC<Props> = ({
  linkedSituation = null,
  onRequestQuickJump,
}) => {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-4" data-testid="news-drawer-tab-linkedSituation-content">
      <div>
        <Kicker dot="blue">{t('news.drawer.linkedSituation.kicker')}</Kicker>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('news.drawer.linkedSituation.helper')}
        </p>
      </div>

      {linkedSituation === null ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-muted-foreground">
            {t('news.drawer.linkedSituation.emptyText')}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                aria-disabled="true"
                className="relative cursor-not-allowed opacity-60"
                onClick={(e) => e.preventDefault()}
              >
                {t('news.drawer.linkedSituation.generate')}
                <span
                  className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive"
                  aria-hidden="true"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('comingSoon')}</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div
          className="dr-sit-card"
          role="button"
          tabIndex={0}
          onClick={() => onRequestQuickJump?.(linkedSituation.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRequestQuickJump?.(linkedSituation.id);
            }
          }}
          data-testid="news-drawer-linked-situation-card"
        >
          <div className="dr-sit-thumb">
            {linkedSituation.hasPicture && linkedSituation.pictureImageUrl ? (
              <img
                className="dr-sit-thumb-img"
                src={linkedSituation.pictureImageUrl}
                srcSet={buildSrcSet(linkedSituation.pictureImageVariants)}
                sizes="(max-width: 640px) 50vw, 160px"
                alt=""
                width={160}
                height={120}
                loading="lazy"
                onError={recoverDerivativeError}
              />
            ) : (
              <span className="dr-sit-flag">{countryToFlag(linkedSituation.country)}</span>
            )}
          </div>
          <div className="dr-sit-body">
            {/* Status + level badges */}
            <div className="dr-sit-badges">
              <span className="dr-sit-status" data-testid="dr-sit-status-badge">
                {tDynamic(t, 'situations.status.' + linkedSituation.status, {
                  defaultValue: linkedSituation.status,
                })}
              </span>
              {linkedSituation.levels.map((level) => (
                <Badge key={level} tone="violet" className="news-level">
                  {level}
                </Badge>
              ))}
            </div>
            <h3 className="dr-sit-title">{linkedSituation.titleEn}</h3>
            <p className="dr-sit-title-el" lang="el">
              {linkedSituation.titleEl}
            </p>
            {(() => {
              const metaSegments = [
                `${linkedSituation.roleCount} roles`,
                linkedSituation.names,
                `${linkedSituation.turnCount} turns`,
                `${linkedSituation.exerciseCount} exercises`,
              ].filter(Boolean);
              const metaText = metaSegments.join(' · ');
              return (
                <p className="dr-sit-meta">
                  {metaText}
                  {metaText ? ' · ' : ''}
                  <span className="dr-sit-audio">
                    <Play size={10} aria-hidden="true" />
                    {formatDurationMSS(linkedSituation.audioDurationSeconds)}
                  </span>
                </p>
              );
            })()}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div
        className="dr-divider-dashed flex gap-2 pt-2"
        data-testid="news-drawer-linked-situation-footer"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-disabled="true"
                className="relative cursor-not-allowed opacity-60"
                onClick={(e) => e.preventDefault()}
              >
                <X size={14} aria-hidden="true" />
                {t('news.drawer.linkedSituation.unlink')}
                <span
                  className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive"
                  aria-hidden="true"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('comingSoon')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-disabled="true"
                className="relative cursor-not-allowed opacity-60"
                onClick={(e) => e.preventDefault()}
              >
                <Wand2 size={14} aria-hidden="true" />
                {t('news.drawer.linkedSituation.regenerate')}
                <span
                  className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive"
                  aria-hidden="true"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('comingSoon')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
