import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminTabNav } from '@/hooks/useAdminTabNav';
import type { SituationDetailResponse } from '@/types/situation';

interface Props {
  situation: SituationDetailResponse;
}

export function SituationDrawerLinkedNews({ situation: _situation }: Props) {
  const { t } = useTranslation('admin');
  useAdminTabNav(); // wired but no openIn() call until backend ships news_item_id

  return (
    <div className="space-y-4" data-testid="situation-drawer-tab-linkedNews-content">
      <div>
        <Kicker dot="primary">{t('situations.drawer.linkedNews.header')}</Kicker>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('situations.drawer.linkedNews.help')}
        </p>
      </div>

      {/* Empty state — permanent in MVP (no linked branch until backend ships news_item_id) */}
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
          <TooltipContent>{t('news.comingSoon')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Footer actions — always disabled in MVP */}
      <div className="flex gap-2 border-t border-border pt-2">
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
          <TooltipContent>{t('news.comingSoon')}</TooltipContent>
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
          <TooltipContent>{t('news.comingSoon')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
