import { useEffect, useRef, useState } from 'react';

import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { getSentry, isSentryLoaded, queueMessage } from '@/lib/sentry-queue';
import { cn } from '@/lib/utils';

interface PictureOptionProps {
  imageUrl: string | null;
  optionIndex: number;
  exerciseId: string;
  alt: string;
  className?: string;
}

type ImgState = 'loading' | 'loaded' | 'error';

export function PictureOption({
  imageUrl,
  optionIndex,
  exerciseId,
  alt,
  className,
}: PictureOptionProps) {
  const { t } = useTranslation('common');
  const [imgState, setImgState] = useState<ImgState>(imageUrl ? 'loading' : 'error');
  const reportedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setImgState(imageUrl ? 'loading' : 'error');
  }, [imageUrl]);

  const handleLoad = () => {
    setImgState('loaded');
  };

  const handleError = () => {
    setImgState('error');

    // Fire Sentry once per URL to avoid duplicate reports
    if (imageUrl && reportedUrlRef.current !== imageUrl) {
      reportedUrlRef.current = imageUrl;
      const context = { url: imageUrl, exercise_id: exerciseId, option_index: optionIndex };
      if (isSentryLoaded()) {
        const Sentry = getSentry();
        if (Sentry) {
          Sentry.withScope((scope) => {
            scope.setExtras(context);
            Sentry.captureMessage(
              `PictureOption: failed to load image (exercise ${exerciseId}, option ${optionIndex})`,
              'warning'
            );
          });
        }
      } else {
        queueMessage(
          `PictureOption: failed to load image (exercise ${exerciseId}, option ${optionIndex})`,
          'warning'
        );
      }
    }
  };

  // Error placeholder (also shown when imageUrl is null)
  if (imgState === 'error') {
    return (
      <div
        className={cn(
          'relative flex aspect-square w-full flex-col items-center justify-center rounded-lg bg-muted',
          className
        )}
        aria-hidden="true"
      >
        <ImageOff className="h-8 w-8 text-muted-foreground" />
        <span className="mt-1 text-xs text-muted-foreground">
          {t('exercises.session.pictureMatch.imageLoadError')}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('relative aspect-square w-full overflow-hidden rounded-lg', className)}>
      {imgState === 'loading' && <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />}
      <img
        src={imageUrl!}
        alt={alt}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-200',
          imgState === 'loaded' ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  );
}
