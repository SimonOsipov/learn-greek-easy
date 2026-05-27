import React from 'react';

import { Play, Wand2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
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
                className="cursor-not-allowed opacity-60"
                onClick={(e) => e.preventDefault()}
              >
                {t('news.drawer.linkedSituation.generate')}
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
            <span className="dr-sit-flag">{countryToFlag(linkedSituation.country)}</span>
          </div>
          <div className="dr-sit-body">
            {/* Status + level badges */}
            <div className="dr-sit-badges">
              <span className="dr-sit-status" data-testid="dr-sit-status-badge">
                {linkedSituation.status === 'ready'
                  ? t('situations.status.ready')
                  : linkedSituation.status}
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
            <p className="dr-sit-meta">
              {linkedSituation.roleCount} roles · {linkedSituation.names} ·{' '}
              {linkedSituation.turnCount} turns · {linkedSituation.exerciseCount} exercises ·{' '}
              <span className="dr-sit-audio">
                <Play size={10} aria-hidden="true" />
                {formatDurationMSS(linkedSituation.audioDurationSeconds)}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div
        className="flex gap-2 pt-2"
        style={{ borderTop: '1px dashed hsl(var(--fg) / 0.1)' }}
        data-testid="news-drawer-linked-situation-footer"
      >
        <button className="btn-glass btn-sm" onClick={() => toast({ title: t('comingSoon') })}>
          <X size={14} aria-hidden="true" />
          {t('news.drawer.linkedSituation.unlink')}
        </button>
        <button className="btn-glass btn-sm" onClick={() => toast({ title: t('comingSoon') })}>
          <Wand2 size={14} aria-hidden="true" />
          {t('news.drawer.linkedSituation.regenerate')}
        </button>
      </div>
    </div>
  );
};
