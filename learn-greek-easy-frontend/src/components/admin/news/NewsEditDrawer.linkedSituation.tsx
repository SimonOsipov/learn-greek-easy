import React from 'react';

import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NewsItemResponse } from '@/services/adminAPI';

// Future MVP+: this prop is wired but never non-null until backend ships the filter.
export interface LinkedSituationSummary {
  id: string;
  titleEn: string;
  titleEl: string;
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
        <Kicker dot="cyan">{t('news.drawer.linkedSituation.kicker')}</Kicker>
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
            <span className="dr-sit-flag">🇨🇾</span>
          </div>
          <div className="dr-sit-body">
            <h3 className="dr-sit-title">{linkedSituation.titleEn}</h3>
            <p className="dr-sit-title-el" lang="el">
              {linkedSituation.titleEl}
            </p>
            <p className="dr-sit-meta">
              {linkedSituation.roleCount} roles · {linkedSituation.names} ·{' '}
              {linkedSituation.turnCount} turns · {linkedSituation.exerciseCount} exercises ·{' '}
              {Math.round(linkedSituation.audioDurationSeconds)}s audio
            </p>
          </div>
          <ArrowRight className="dr-sit-go" />
        </div>
      )}

      {/* Footer actions — always disabled in MVP */}
      <div className="flex gap-2 border-t border-border pt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              aria-disabled="true"
              className="cursor-not-allowed opacity-60"
              onClick={(e) => e.preventDefault()}
            >
              {t('news.drawer.linkedSituation.unlink')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('comingSoon')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              aria-disabled="true"
              className="cursor-not-allowed opacity-60"
              onClick={(e) => e.preventDefault()}
            >
              {t('news.drawer.linkedSituation.regenerate')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('comingSoon')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
