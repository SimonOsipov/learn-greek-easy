// src/components/admin/announcements/AnnouncementJsonView.tsx

/**
 * AnnouncementJsonView
 *
 * Read-only "Raw payload" view (CD "sent verbatim") — replaces the old
 * paste/validate AnnouncementJsonInput (ADMIN2-43-06, D8/D15).
 *
 * Renders a monospaced, readOnly Textarea whose value is the serialized
 * payload of the live compose-form values:
 *   JSON.stringify({ title, message, link_url }, null, 2)
 *
 * Locked convention (prototype.jsx:108 — `link_url: link`, `link` defaults to
 * ""): `link_url` is ALWAYS emitted — an empty string when blank, never
 * omitted, never null. No Preview button; no parse/validate/submit path.
 */

import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AnnouncementJsonViewProps {
  title: string;
  message: string;
  linkUrl: string;
}

export function AnnouncementJsonView({ title, message, linkUrl }: AnnouncementJsonViewProps) {
  const { t } = useTranslation('admin');

  const payload = JSON.stringify({ title, message, link_url: linkUrl }, null, 2);

  return (
    <div className="space-y-2">
      <Label htmlFor="announcement-json-view">{t('announcements.create.jsonRawLabel')}</Label>
      <Textarea
        id="announcement-json-view"
        value={payload}
        readOnly
        className="min-h-[280px] font-mono text-sm"
        data-testid="announcement-json-view-textarea"
      />
      <p className="text-sm text-muted-foreground">{t('announcements.create.jsonRawHint')}</p>
    </div>
  );
}
