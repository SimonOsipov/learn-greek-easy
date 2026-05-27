import React from 'react';

import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/kicker';
import type { NewsItemResponse } from '@/services/adminAPI';

import type { NewsDrawerFormData } from './NewsEditDrawer';

interface Props {
  item: NewsItemResponse;
}

export const NewsEditDrawerImage: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation('admin');
  const { register } = useFormContext<NewsDrawerFormData>();

  return (
    <div className="dr-image-tab" data-testid="news-drawer-tab-image-content">
      {/* Left column: preview box + overlay */}
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

      {/* Right column: stacked fields */}
      <div className="space-y-4">
        <Field
          label={
            <label htmlFor="news-image-url" className="text-sm font-medium">
              {t('news.drawer.image.sourceUrl')}
            </label>
          }
        >
          <Input
            id="news-image-url"
            type="url"
            {...register('source_image_url')}
            placeholder="https://…"
            data-testid="news-drawer-image-url-input"
          />
        </Field>

        <Field
          label={
            <label htmlFor="news-image-alt" className="text-sm font-medium">
              {t('news.drawer.image.altText')}
            </label>
          }
        >
          <Input
            id="news-image-alt"
            {...register('alt_text')}
            data-testid="news-drawer-image-alt-input"
          />
        </Field>

        <Field
          label={
            <label htmlFor="news-image-credit" className="text-sm font-medium">
              {t('news.drawer.image.photoCredit')}
            </label>
          }
        >
          <Input
            id="news-image-credit"
            {...register('photo_credit')}
            data-testid="news-drawer-image-credit-input"
          />
        </Field>
      </div>
    </div>
  );
};
