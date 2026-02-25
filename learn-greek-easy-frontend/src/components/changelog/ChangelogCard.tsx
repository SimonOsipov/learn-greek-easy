/**
 * Card component for displaying a single changelog entry.
 */

import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChangelogItem, ChangelogTag } from '@/types/changelog';
import { CHANGELOG_TAG_CONFIG } from '@/types/changelog';

interface ChangelogCardProps {
  entry: ChangelogItem;
}

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
  const { i18n } = useTranslation();

  // Format date using user's locale (follows AchievementCard pattern)
  const formattedDate = new Date(entry.created_at).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card className="w-full" data-testid="changelog-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-lg font-semibold leading-tight">{entry.title}</CardTitle>
            <time dateTime={entry.created_at} className="text-sm text-muted-foreground">
              {formattedDate}
            </time>
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
