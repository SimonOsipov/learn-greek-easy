import React from 'react';

import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/ui/field';
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
      <Field
        label={t('news.drawer.translations.titleEn')}
        hint={t('news.drawer.translations.hintEn')}
        htmlFor="news-translations-title-en"
      >
        <Textarea
          id="news-translations-title-en"
          rows={2}
          {...register('title_en')}
          data-testid="news-drawer-translations-title-en"
        />
      </Field>

      {/* Τίτλος — Ελληνικά */}
      <Field
        label={t('news.drawer.translations.titleEl')}
        hint={t('news.drawer.translations.hintEl')}
        htmlFor="news-translations-title-el"
      >
        <Textarea
          id="news-translations-title-el"
          rows={2}
          lang="el"
          className="serif"
          {...register('title_el')}
          data-testid="news-drawer-translations-title-el"
        />
      </Field>

      {/* Заголовок — Русский */}
      <Field
        label={t('news.drawer.translations.titleRu')}
        hint={t('news.drawer.translations.hintRu')}
        htmlFor="news-translations-title-ru"
      >
        <Textarea
          id="news-translations-title-ru"
          rows={2}
          {...register('title_ru')}
          data-testid="news-drawer-translations-title-ru"
        />
      </Field>
    </div>
  );
};
