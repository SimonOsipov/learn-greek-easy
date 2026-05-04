import { useState, useCallback } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/apiErrorUtils';
import { adminAPI } from '@/services/adminAPI';
import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type { PictureNested } from '@/types/situation';

interface PicturePromptFormProps {
  situationId: string;
  picture: PictureNested;
}

type FormState = {
  scene_en: string;
  scene_el: string;
  scene_ru: string;
  style_en: string;
};

function hydrateForm(picture: PictureNested): FormState {
  return {
    scene_en: picture.scene_en ?? '',
    scene_el: picture.scene_el ?? '',
    scene_ru: picture.scene_ru ?? '',
    style_en: picture.style_en ?? '',
  };
}

export function PicturePromptForm({ situationId, picture }: PicturePromptFormProps) {
  const { t } = useTranslation('admin');

  const [initial, setInitial] = useState<FormState>(() => hydrateForm(picture));
  const [form, setForm] = useState<FormState>(() => hydrateForm(picture));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived flags
  const pristine =
    form.scene_en === initial.scene_en &&
    form.scene_el === initial.scene_el &&
    form.scene_ru === initial.scene_ru &&
    form.style_en === initial.style_en;

  const trioFilled = [
    form.scene_en.trim().length > 0,
    form.scene_el.trim().length > 0,
    form.scene_ru.trim().length > 0,
  ];
  const trioPartial = trioFilled.some(Boolean) && !trioFilled.every(Boolean);

  const saveDisabled = pristine || trioPartial || isSaving;

  const handleChange = useCallback(
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setError(null);
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (saveDisabled) return;

    setIsSaving(true);
    setError(null);

    const payload = {
      scene_en: form.scene_en.trim() || null,
      scene_el: form.scene_el.trim() || null,
      scene_ru: form.scene_ru.trim() || null,
      style_en: form.style_en.trim() || null,
    };

    try {
      await adminAPI.updateSituationPicture(situationId, payload);
      await useAdminSituationStore.getState().fetchSituationDetail(situationId);
      toast({ title: t('situations.detail.picturePrompt.savedToast') });
      // Mark form pristine at current values
      setInitial({ ...form });
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg ?? (err instanceof Error ? err.message : t('situations.detail.fetchError')));
    } finally {
      setIsSaving(false);
    }
  }, [saveDisabled, situationId, form, t]);

  const handleCancel = useCallback(() => {
    setForm({ ...initial });
    setError(null);
  }, [initial]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !saveDisabled) {
        e.preventDefault();
        void handleSave();
      }
    },
    [saveDisabled, handleSave]
  );

  const fields: {
    key: keyof FormState;
    rows: number;
  }[] = [
    { key: 'scene_en', rows: 3 },
    { key: 'scene_el', rows: 3 },
    { key: 'scene_ru', rows: 3 },
    { key: 'style_en', rows: 2 },
  ];

  return (
    <div className="space-y-4" data-testid="picture-prompt-form">
      <p className="text-sm font-medium">{t('situations.detail.picturePrompt.sectionTitle')}</p>

      {fields.map(({ key, rows }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`picture-prompt-${key}`}>
            {t(`situations.detail.picturePrompt.labels.${key}`)}
          </Label>
          <Textarea
            id={`picture-prompt-${key}`}
            data-testid={`picture-prompt-${key.replace('_', '-')}`}
            value={form[key]}
            onChange={handleChange(key)}
            onKeyDown={handleKeyDown}
            placeholder={t(`situations.detail.picturePrompt.placeholders.${key}`)}
            rows={rows}
            maxLength={1000}
            disabled={isSaving}
          />
          <p
            className={`text-xs ${form[key].length >= 1000 ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {form[key].length} / 1000
          </p>
        </div>
      ))}

      {trioPartial && (
        <Alert variant="destructive">
          <AlertDescription>{t('situations.detail.picturePrompt.trioRuleHint')}</AlertDescription>
        </Alert>
      )}

      {error && !trioPartial && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={pristine || isSaving}
          data-testid="picture-prompt-cancel"
        >
          {t('situations.detail.picturePrompt.cancel')}
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saveDisabled}
          data-testid="picture-prompt-save"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('situations.detail.picturePrompt.save')}
            </>
          ) : (
            t('situations.detail.picturePrompt.save')
          )}
        </Button>
      </div>
    </div>
  );
}
