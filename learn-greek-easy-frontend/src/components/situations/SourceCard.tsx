import { ExternalLink } from 'lucide-react';

import { buildSrcSet, type ImageVariants } from '@/lib/imageVariants';
import { cn } from '@/lib/utils';

interface SourceCardProps {
  sourceUrl: string;
  sourceImageUrl?: string | null;
  /** WebP derivative URLs for sourceImageUrl (PERF-10). */
  sourceImageVariants?: ImageVariants;
  sourceTitle?: string | null;
  className?: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const SourceCard: React.FC<SourceCardProps> = ({
  sourceUrl,
  sourceImageUrl,
  sourceImageVariants,
  sourceTitle,
  className,
}) => {
  const displayTitle = sourceTitle || extractDomain(sourceUrl);

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block overflow-hidden rounded-lg border bg-muted/40 transition-colors hover:bg-muted/70',
        className
      )}
    >
      {sourceImageUrl && (
        <img
          src={sourceImageUrl}
          srcSet={buildSrcSet(sourceImageVariants)}
          sizes="(max-width: 768px) 100vw, 50vw"
          alt=""
          width={800}
          height={450}
          className="aspect-video w-full object-cover"
          loading="lazy"
        />
      )}
      <div className="flex items-center gap-2 px-4 py-3 text-sm">
        <span className="flex-1 font-medium text-foreground">{displayTitle}</span>
        <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      </div>
    </a>
  );
};
