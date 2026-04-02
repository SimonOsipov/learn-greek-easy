import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SourceCardProps {
  sourceUrl: string;
  sourceImageUrl?: string | null;
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
        'flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm transition-colors hover:bg-muted/70',
        className
      )}
    >
      {sourceImageUrl && (
        <img src={sourceImageUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded object-cover" />
      )}
      <span className="flex-1 font-medium text-foreground">{displayTitle}</span>
      <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    </a>
  );
};
