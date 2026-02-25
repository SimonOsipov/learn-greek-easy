/**
 * Card component for displaying a single changelog entry.
 */

import { Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { ChangelogItem, ChangelogTag } from '@/types/changelog';
import { CHANGELOG_TAG_CONFIG } from '@/types/changelog';

interface ChangelogCardProps {
  entry: ChangelogItem;
}

const TAG_BORDER_COLORS: Record<ChangelogTag, string> = {
  new_feature: 'border-l-green-500',
  bug_fix: 'border-l-amber-500',
  announcement: 'border-l-blue-500',
};

/**
 * Tag badge with appropriate color styling.
 */
function TagBadge({ tag }: { tag: ChangelogTag }) {
  const { t } = useTranslation();
  const config = CHANGELOG_TAG_CONFIG[tag];

  return (
    <Badge variant="secondary" className={config.colorClass} data-testid="tag-badge">
      {t(config.labelKey)}
    </Badge>
  );
}

export function ChangelogCard({ entry }: ChangelogCardProps) {
  const { t, i18n } = useTranslation('changelog');

  // Format date using user's locale (follows AchievementCard pattern)
  const formattedDate = new Date(entry.created_at).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const { toast } = useToast();

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#entry-${entry.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t('linkCopied'),
        description: t('linkCopiedMessage'),
      });
    } catch {
      // Clipboard API unavailable (insecure context) — silent fail
    }
  };

  return (
    <Card
      id={`entry-${entry.id}`}
      className={`group w-full border-l-4 ${TAG_BORDER_COLORS[entry.tag]}`}
      data-testid="changelog-card"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-lg font-semibold leading-tight">{entry.title}</CardTitle>
            <div className="flex items-center gap-1">
              <time dateTime={entry.created_at} className="text-sm text-muted-foreground">
                {formattedDate}
              </time>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                onClick={handleCopyLink}
                aria-label={t('copyLink')}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <TagBadge tag={entry.tag} />
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="text-sm leading-relaxed text-muted-foreground"
          data-testid="changelog-content"
        >
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="ml-4 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
              em: ({ children }) => <em>{children}</em>,
              h2: ({ children }) => (
                <h2 className="mb-1 mt-3 text-base font-semibold text-foreground">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-1 mt-2 text-sm font-semibold text-foreground">{children}</h3>
              ),
            }}
          >
            {entry.content}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
