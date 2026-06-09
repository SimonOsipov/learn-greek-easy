import { useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useSSE } from '@/hooks/useSSE';
import { adminAPI, getPictureGenerationStreamUrl } from '@/services/adminAPI';
import type { PictureNested } from '@/types/situation';

interface PictureGenerationPanelProps {
  situationId: string;
  picture: PictureNested;
  onCompleted: () => void;
}

type PicStage = 'starting' | 'generating' | 'uploading' | 'persisting' | null;

export function PictureGenerationPanel({
  situationId,
  picture,
  onCompleted,
}: PictureGenerationPanelProps) {
  const { t } = useTranslation('admin');

  const [picSseEnabled, setPicSseEnabled] = useState(false);
  const [picStage, setPicStage] = useState<PicStage>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useSSE<{
    situation_id: string;
    picture_id?: string;
    stage?: string;
    error?: string;
    image_url?: string;
    s3_key?: string;
    model?: string;
    aspect_ratio?: string;
  }>(picSseEnabled ? getPictureGenerationStreamUrl(situationId) : '', {
    method: 'POST',
    body: {},
    enabled: picSseEnabled,
    maxRetries: 0,
    reconnect: false,
    onEvent: (event) => {
      const data = event.data ?? ({} as Record<string, unknown>);
      switch (event.type) {
        case 'picture:start':
          setPicStage('starting');
          break;
        case 'picture:generate':
          setPicStage('generating');
          break;
        case 'picture:upload':
          setPicStage('uploading');
          break;
        case 'picture:persist':
          setPicStage('persisting');
          break;
        case 'picture:complete':
          setPicStage(null);
          setPicSseEnabled(false);
          onCompleted();
          break;
        case 'picture:error':
          setPicStage(null);
          setPicSseEnabled(false);
          toast({
            title:
              (data as { error?: string }).error || t('situations.detail.picture.errorFallback'),
            variant: 'destructive',
          });
          break;
      }
    },
    onError: () => {
      setPicStage(null);
      setPicSseEnabled(false);
      toast({
        title: t('situations.detail.picture.errorFallback'),
        variant: 'destructive',
      });
    },
  });

  const buttonLabel = () => {
    if (picStage === 'starting') return t('situations.detail.picture.progress.starting');
    if (picStage === 'generating') return t('situations.detail.picture.progress.generating');
    if (picStage === 'uploading') return t('situations.detail.picture.progress.uploading');
    if (picStage === 'persisting') return t('situations.detail.picture.progress.persisting');
    if (picture.image_url) return t('situations.detail.picture.regenerate');
    return t('situations.detail.picture.generate');
  };

  const handleGenerateClick = () => {
    if (picture.image_url) {
      setConfirmOpen(true);
    } else {
      setPicSseEnabled(true);
    }
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so re-selecting the same file fires onChange again
    e.target.value = '';
    setIsUploading(true);
    try {
      await adminAPI.uploadSituationPicture(situationId, file);
      onCompleted();
      toast({ title: t('situations.detail.picture.uploadSuccess') });
    } catch {
      toast({
        title: t('situations.detail.picture.uploadError'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {picture.image_url && (
        <img
          src={picture.image_url}
          alt={t('situations.detail.picture.alt')}
          className="aspect-video w-full rounded object-cover"
        />
      )}

      <div className="flex gap-2">
        <Button
          variant={picture.image_url ? 'outline' : 'default'}
          size="sm"
          disabled={picSseEnabled || isUploading}
          onClick={handleGenerateClick}
        >
          {buttonLabel()}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={picSseEnabled || isUploading}
          onClick={() => uploadInputRef.current?.click()}
          data-testid="picture-upload-button"
        >
          {t('situations.detail.picture.upload')}
        </Button>
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="picture-upload-input"
          onChange={(e) => void handleUploadChange(e)}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('situations.detail.picture.confirmRegenerateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('situations.detail.picture.confirmRegenerateBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              {t('situations.detail.picture.confirmRegenerateCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                setPicSseEnabled(true);
              }}
            >
              {t('situations.detail.picture.confirmRegenerateConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
