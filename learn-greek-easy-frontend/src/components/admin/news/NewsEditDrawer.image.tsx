import React from 'react';

import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/kicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NewsItemResponse } from '@/services/adminAPI';

import type { NewsDrawerFormData } from './NewsEditDrawer';

interface Props {
  item: NewsItemResponse;
}

export const NewsEditDrawerImage: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation('admin');
  const { register } = useFormContext<NewsDrawerFormData>();

  return (
    <div className="space-y-4" data-testid="news-drawer-tab-image-content">
      {/* 16:9 preview + overlay */}
      <div className="dr-image-preview">
        <div className="dr-image-box">
          {item.image_url ? (
            <img src={item.image_url} alt="" />
          ) : (
            <div className="dr-image-fallback" />
          )}
        </div>
        <div className="dr-image-overlay">
          <Kicker dot="primary">{t('news.drawer.image.kicker')}</Kicker>
          <p className="text-sm text-muted-foreground">{t('news.drawer.image.helper')}</p>
        </div>
      </div>

      {/* Source image URL */}
      <div>
        <label htmlFor="news-image-url" className="text-sm font-medium">
          {t('news.drawer.image.sourceUrl')}
        </label>
        <Input
          id="news-image-url"
          type="url"
          {...register('source_image_url')}
          placeholder="https://…"
          data-testid="news-drawer-image-url-input"
        />
      </div>

      {/* Alt text — disabled */}
      <div>
        <label htmlFor="news-image-alt" className="text-sm font-medium opacity-60">
          {t('news.drawer.image.altText')}
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Input
              id="news-image-alt"
              disabled
              aria-disabled="true"
              data-testid="news-drawer-image-alt-input"
              className="cursor-not-allowed opacity-60"
            />
          </TooltipTrigger>
          <TooltipContent>{t('news.comingSoon')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Photo credit — disabled */}
      <div>
        <label htmlFor="news-image-credit" className="text-sm font-medium opacity-60">
          {t('news.drawer.image.photoCredit')}
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Input
              id="news-image-credit"
              disabled
              aria-disabled="true"
              data-testid="news-drawer-image-credit-input"
              className="cursor-not-allowed opacity-60"
            />
          </TooltipTrigger>
          <TooltipContent>{t('news.comingSoon')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
