import React from 'react';

import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Textarea } from '@/components/ui/textarea';
import type { NewsItemResponse } from '@/services/adminAPI';

import type { NewsDrawerFormData } from './NewsEditDrawer';

interface Props {
  item: NewsItemResponse;
}

export const NewsEditDrawerTranslations: React.FC<Props> = () => {
  const { t } = useTranslation('admin');
  const { register } = useFormContext<NewsDrawerFormData>();

  return (
    <div className="space-y-4" data-testid="news-drawer-tab-translations-content">
      {/* Title — English (source) */}
      <div>
        <label htmlFor="news-title-en" className="text-sm font-medium">
          {t('news.drawer.translations.titleEn')}
        </label>
        <Textarea
          id="news-title-en"
          rows={2}
          {...register('title_en')}
          data-testid="news-drawer-translations-title-en"
        />
        <p className="dr-field-h">{t('news.drawer.translations.hintEn')}</p>
      </div>

      {/* Τίτλος — Ελληνικά */}
      <div>
        <label htmlFor="news-title-el" className="text-sm font-medium">
          {t('news.drawer.translations.titleEl')}
        </label>
        <Textarea
          id="news-title-el"
          rows={2}
          lang="el"
          className="serif"
          {...register('title_el')}
          data-testid="news-drawer-translations-title-el"
        />
        <p className="dr-field-h">{t('news.drawer.translations.hintEl')}</p>
      </div>

      {/* Заголовок — Русский */}
      <div>
        <label htmlFor="news-title-ru" className="text-sm font-medium">
          {t('news.drawer.translations.titleRu')}
        </label>
        <Textarea
          id="news-title-ru"
          rows={2}
          {...register('title_ru')}
          data-testid="news-drawer-translations-title-ru"
        />
        <p className="dr-field-h">{t('news.drawer.translations.hintRu')}</p>
      </div>
    </div>
  );
};
