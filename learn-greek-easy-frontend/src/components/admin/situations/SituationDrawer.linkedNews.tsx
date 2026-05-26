// src/components/admin/situations/SituationDrawer.linkedNews.tsx
//
// SAR2-26-17b: Linked-news tab.
// When situation.linked_news is set → rich article card + active footer actions.
// When situation.linked_news is null → empty state (existing MVP behaviour).

import { useState } from 'react';

import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { useAdminTabNav } from '@/hooks/useAdminTabNav';
import { adminAPI } from '@/services/adminAPI';
import { APIRequestError } from '@/services/api';
import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type { SituationDetailResponse } from '@/types/situation';

import { pickSitTone } from './thumbnails';

// Simple country → flag emoji map (extend as needed)
const COUNTRY_FLAG: Record<string, string> = {
  gr: '🇬🇷',
  greece: '🇬🇷',
  cy: '🇨🇾',
  cyprus: '🇨🇾',
  world: '🌍',
};

function countryFlag(country: string): string {
  return COUNTRY_FLAG[country.toLowerCase()] ?? '';
}

interface Props {
  situation: SituationDetailResponse;
}

export function SituationDrawerLinkedNews({ situation }: Props) {
  const { t } = useTranslation('admin');
  const { openIn } = useAdminTabNav();
  const fetchSituationDetail = useAdminSituationStore((s) => s.fetchSituationDetail);
  const closeDrawer = useAdminSituationStore((s) => s.closeDrawer);

  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isReDeriving, setIsReDeriving] = useState(false);

  const linkedNews = situation.linked_news;

  async function handleUnlink() {
    setIsUnlinking(true);
    try {
      await adminAPI.unlinkSituationNews(situation.id);
      await fetchSituationDetail(situation.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsUnlinking(false);
    }
  }

  async function handleReDerive() {
    setIsReDeriving(true);
    try {
      await adminAPI.reDeriveSituationFromNews(situation.id);
    } catch (e) {
      if (e instanceof APIRequestError && e.status === 501) {
        toast({ title: t('situations.drawer.linkedNews.reDerivePending') });
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        toast({ title: msg, variant: 'destructive' });
      }
    } finally {
      setIsReDeriving(false);
    }
  }

  function handleCardClick() {
    if (!linkedNews) return;
    closeDrawer();
    openIn('news', { edit: linkedNews.id });
  }

  return (
    <div className="space-y-4" data-testid="situation-drawer-tab-linkedNews-content">
      <div>
        <Kicker dot="primary">{t('situations.drawer.linkedNews.kicker')}</Kicker>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('situations.drawer.linkedNews.help')}
        </p>
      </div>

      {linkedNews ? (
        /* ── Rich article card ────────────────────────────────────────────── */
        <button
          type="button"
          className="linked-news-card group w-full cursor-pointer rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="linked-news-card"
          onClick={handleCardClick}
        >
          <div className="flex items-start gap-3">
            {/* Tinted thumbnail swatch */}
            <div
              className={`sit-thumb sit-thumb-${pickSitTone(situation.id)} h-10 w-10 shrink-0 rounded`}
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              {/* Country flag + meta */}
              <p className="mb-1 text-xs text-muted-foreground">
                {countryFlag(linkedNews.country)}
                {countryFlag(linkedNews.country) && ' '}
                {new Date(linkedNews.published_at).toLocaleDateString()}
              </p>

              {/* Title */}
              <p className="truncate text-sm font-medium leading-snug">{linkedNews.title_en}</p>
            </div>

            <ArrowRight
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
        </button>
      ) : (
        /* ── Empty state ────────────────────────────────────────────────── */
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-muted-foreground">{t('situations.drawer.linkedNews.empty')}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="default"
                  aria-disabled="true"
                  className="cursor-not-allowed opacity-60"
                  onClick={(e) => e.preventDefault()}
                >
                  {t('situations.drawer.linkedNews.linkCta')}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('comingSoon')}</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Footer actions — active when linked_news is set, disabled otherwise */}
      <div className="flex gap-2 border-t border-border pt-2">
        {linkedNews ? (
          <>
            <Button
              variant="outline"
              disabled={isUnlinking}
              onClick={() => void handleUnlink()}
              data-testid="linked-news-unlink-btn"
            >
              {t('situations.drawer.linkedNews.unlink')}
            </Button>
            <Button
              variant="default"
              disabled={isReDeriving}
              onClick={() => void handleReDerive()}
              data-testid="linked-news-re-derive-btn"
            >
              {isReDeriving
                ? t('situations.drawer.linkedNews.reDerivePending')
                : t('situations.drawer.linkedNews.reDerive')}
            </Button>
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    aria-disabled="true"
                    className="cursor-not-allowed opacity-60"
                    onClick={(e) => e.preventDefault()}
                  >
                    {t('situations.drawer.linkedNews.unlink')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('comingSoon')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    aria-disabled="true"
                    className="cursor-not-allowed opacity-60"
                    onClick={(e) => e.preventDefault()}
                  >
                    {t('situations.drawer.linkedNews.reDerive')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('comingSoon')}</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
