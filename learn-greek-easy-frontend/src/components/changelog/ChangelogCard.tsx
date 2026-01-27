/**
 * Card component for displaying a single changelog entry.
 */

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChangelogItem, ChangelogTag } from '@/types/changelog';
import { CHANGELOG_TAG_CONFIG } from '@/types/changelog';

interface ChangelogCardProps {
  entry: ChangelogItem;
}

/**
 * Render content with basic markdown (bold and italic).
 * Converts **text** to <strong> and *text* to <em>.
 */
function renderMarkdown(content: string): React.ReactNode {
  // Split by markdown patterns while preserving delimiters
  const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    // Italic: *text*
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    // Plain text
    return part;
  });
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
        <p className="text-sm leading-relaxed text-muted-foreground">
          {renderMarkdown(entry.content)}
        </p>
      </CardContent>
    </Card>
  );
}
