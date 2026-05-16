import React, { useEffect, useRef } from 'react';

import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Textarea } from '@/components/ui/textarea';
import type { NewsItemResponse } from '@/services/adminAPI';

import { validateA2Pair } from './newsJsonValidation';

import type { NewsDrawerFormData } from './NewsEditDrawer';

interface Props {
  item: NewsItemResponse;
}

export const NewsEditDrawerBody: React.FC<Props> = () => {
  const { t } = useTranslation('admin');
  const { control, register, setError, clearErrors, formState } =
    useFormContext<NewsDrawerFormData>();

  // Reactive watch on the A2 pair fields.
  const titleElA2 = useWatch({ control, name: 'title_el_a2' });
  const descriptionElA2 = useWatch({ control, name: 'description_el_a2' });

  // Track the last valid/invalid result to avoid calling setError/clearErrors on
  // repeated renders with the same outcome — prevents infinite update loops.
  const lastResultRef = useRef<'valid' | 'invalid' | null>(null);

  useEffect(() => {
    // Normalize empty string to null for the helper's null-equivalence semantics.
    const norm = (v: string | null | undefined): string | null => (v && v.trim() !== '' ? v : null);
    const result = validateA2Pair({ scenarioA2: norm(titleElA2), textA2: norm(descriptionElA2) });
    const nextResult = result.valid ? 'valid' : 'invalid';

    if (nextResult === lastResultRef.current) return; // no change — skip to avoid loops
    lastResultRef.current = nextResult;

    if (result.valid) {
      clearErrors('description_el_a2');
    } else {
      setError('description_el_a2', { type: 'manual', message: t(result.messageKey) });
    }
  }, [titleElA2, descriptionElA2, setError, clearErrors, t]);

  const a2Error = formState.errors.description_el_a2?.message;

  return (
    <div className="space-y-4" data-testid="news-drawer-tab-body-content">
      {/* Greek body */}
      <div>
        <label htmlFor="news-body-description-el" className="text-sm font-medium">
          {t('news.drawer.body.greekBody')}
        </label>
        <Textarea
          id="news-body-description-el"
          rows={10}
          lang="el"
          className="serif"
          {...register('description_el')}
          data-testid="news-drawer-body-description-el"
        />
      </div>

      {/* 2-col row: Title B2 + Scenario A2 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="news-body-title-el" className="text-sm font-medium">
            {t('news.drawer.body.titleB2')}
          </label>
          <Textarea
            id="news-body-title-el"
            rows={2}
            lang="el"
            className="serif"
            {...register('title_el')}
            data-testid="news-drawer-body-title-el"
          />
          <p className="dr-field-h">{t('news.drawer.body.titleB2Hint')}</p>
        </div>
        <div>
          <label htmlFor="news-body-description-el-a2" className="text-sm font-medium">
            {t('news.drawer.body.scenarioA2')}
          </label>
          <Textarea
            id="news-body-description-el-a2"
            rows={5}
            lang="el"
            className="serif"
            {...register('description_el_a2')}
            data-testid="news-drawer-body-description-el-a2"
          />
          {a2Error ? (
            <p className="dr-field-err" data-testid="news-drawer-body-a2-error">
              {a2Error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};
