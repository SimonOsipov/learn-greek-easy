import { Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type { SituationDetailResponse } from '@/types/situation';

import { PictureGenerationPanel } from './PictureGenerationPanel';
import { PicturePromptForm } from './SituationPicturePromptForm';
import { pickSitTone } from './thumbnails';

interface Props {
  situation: SituationDetailResponse;
}

export function SituationDrawerPicture({ situation }: Props) {
  const { t } = useTranslation('admin');
  const fetchSituationDetail = useAdminSituationStore((s) => s.fetchSituationDetail);

  if (!situation.picture) {
    return (
      <div
        className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground"
        data-testid="situation-picture-empty"
      >
        <Image className="h-8 w-8 opacity-40" />
        <p className="text-sm">{t('situations.detail.pictureEmpty')}</p>
      </div>
    );
  }

  const tone = pickSitTone(situation.id);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2" data-testid="situation-drawer-picture">
      <div>
        {/* When no image_url, render gradient fallback instead of empty space */}
        {!situation.picture.image_url && (
          <div
            className={`sit-thumb sit-thumb-${tone} mb-3`}
            data-testid="situation-picture-gradient"
          />
        )}
        <PictureGenerationPanel
          situationId={situation.id}
          picture={situation.picture}
          onCompleted={() => {
            void fetchSituationDetail(situation.id);
          }}
        />
      </div>
      <div>
        <PicturePromptForm situationId={situation.id} picture={situation.picture} />
      </div>
    </div>
  );
}
