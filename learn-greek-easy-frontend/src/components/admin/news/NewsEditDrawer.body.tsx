import React, { useEffect, useRef } from 'react';

import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/ui/field';
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
      <Field label={t('news.drawer.body.greekBody')} hint={t('news.drawer.body.greekBodyHelper')}>
        <Textarea
          id="news-body-description-el"
          rows={10}
          lang="el"
          className="serif"
          {...register('description_el')}
          data-testid="news-drawer-body-description-el"
        />
      </Field>

      {/* 2-col row: Scenario B2 (left) + A2 pair (right) */}
      <div className="dr-2col">
        {/* Left: Scenario — B2 (Greek) — replaces the old Title B2 duplicate */}
        <Field
          label={t('news.drawer.body.scenarioB2')}
          hint={t('news.drawer.body.scenarioB2Helper')}
        >
          <Textarea
            id="news-body-scenario-el"
            rows={5}
            lang="el"
            className="serif"
            {...register('title_el')}
            data-testid="news-drawer-body-scenario-el"
          />
        </Field>

        {/* Right: A2 pair — Title A2 + Scenario A2 */}
        <div className="dr-field">
          <Field label={t('news.drawer.body.titleA2')}>
            <Textarea
              id="news-body-title-el-a2"
              rows={2}
              lang="el"
              className="serif"
              {...register('title_el_a2')}
              data-testid="news-drawer-body-title-el-a2"
            />
          </Field>
          <Field label={t('news.drawer.body.scenarioA2')}>
            <Textarea
              id="news-body-description-el-a2"
              rows={5}
              lang="el"
              className="serif"
              {...register('description_el_a2')}
              data-testid="news-drawer-body-description-el-a2"
            />
          </Field>
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
