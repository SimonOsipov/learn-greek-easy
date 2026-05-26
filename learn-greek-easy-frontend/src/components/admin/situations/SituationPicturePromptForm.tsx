import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PictureNested } from '@/types/situation';

import type { SituationDrawerFormData } from './SituationDrawer';

interface PicturePromptFormProps {
  situationId: string;
  picture: PictureNested;
}

type PictureField = 'scene_en' | 'scene_el' | 'scene_ru' | 'style_en';

const FIELDS: { key: PictureField; rows: number }[] = [
  { key: 'scene_en', rows: 3 },
  { key: 'scene_el', rows: 3 },
  { key: 'scene_ru', rows: 3 },
  { key: 'style_en', rows: 2 },
];

export function PicturePromptForm({
  situationId: _situationId,
  picture: _picture,
}: PicturePromptFormProps) {
  const { t } = useTranslation('admin');
  const { register } = useFormContext<SituationDrawerFormData>();

  return (
    <div className="space-y-4" data-testid="picture-prompt-form">
      <p className="text-sm font-medium">{t('situations.detail.picturePrompt.sectionTitle')}</p>

      {FIELDS.map(({ key, rows }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`picture-prompt-${key}`}>
            {t(`situations.detail.picturePrompt.labels.${key}`)}
          </Label>
          <Textarea
            id={`picture-prompt-${key}`}
            data-testid={`picture-prompt-${key.replaceAll('_', '-')}`}
            rows={rows}
            placeholder={t(`situations.detail.picturePrompt.placeholders.${key}`)}
            {...register(`picture.${key}`)}
          />
          {t(`situations.detail.picturePrompt.hints.${key}`, '') && (
            <p
              className="text-xs text-muted-foreground"
              data-testid={`picture-prompt-hint-${key.replaceAll('_', '-')}`}
            >
              {t(`situations.detail.picturePrompt.hints.${key}`)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
