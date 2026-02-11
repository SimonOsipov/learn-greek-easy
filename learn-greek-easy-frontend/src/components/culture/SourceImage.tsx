import { type FC, useEffect, useState } from 'react';

import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SourceImageProps {
  /** Image URL to display. Component returns null if empty/undefined. */
  imageUrl: string;
  /** Article title displayed in the badge overlay */
  title?: string;
  /** Source article URL. When provided, wraps component in <a> tag. */
  sourceUrl?: string;
  /** Callback fired when the source link is clicked */
  onSourceClick?: () => void;
  /** Additional CSS classes applied to the outer container */
  className?: string;
}

export const SourceImage: FC<SourceImageProps> = ({
  imageUrl,
  title,
  sourceUrl,
  onSourceClick,
  className,
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  if (!imageUrl || hasError) return null;

  const containerClasses = cn(
    'relative block w-full overflow-hidden rounded-[14px] border border-slate-200',
    className
  );

  const innerContent = (
    <>
      <img
        src={imageUrl}
        alt=""
        className="h-[140px] w-full object-cover"
        loading="lazy"
        onError={() => setHasError(true)}
        data-testid="source-image"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
        }}
        aria-hidden="true"
        data-testid="source-image-gradient"
      />
      {sourceUrl && (
        <div
          className="absolute bottom-2 left-2 flex items-center gap-1 text-xs font-semibold text-white"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          data-testid="source-image-badge"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span className="line-clamp-1">{title || 'Read source article'}</span>
        </div>
      )}
    </>
  );

  if (sourceUrl) {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={containerClasses}
        onClick={onSourceClick}
        data-testid="source-image-container"
      >
        {innerContent}
      </a>
    );
  }

  return (
    <div className={containerClasses} data-testid="source-image-container">
      {innerContent}
    </div>
  );
};
