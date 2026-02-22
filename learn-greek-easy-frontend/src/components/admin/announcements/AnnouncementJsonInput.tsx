// src/components/admin/announcements/AnnouncementJsonInput.tsx

import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import type { AnnouncementCreateFormData } from './AnnouncementCreateForm';

interface AnnouncementJsonInputProps {
  onPreview: (data: AnnouncementCreateFormData) => void;
  isSubmitting?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  resetKey?: number;
}

export function AnnouncementJsonInput({
  onPreview,
  isSubmitting,
  onDirtyChange,
  resetKey,
}: AnnouncementJsonInputProps) {
  const { t } = useTranslation('admin');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue('');
    setError(null);
  }, [resetKey]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onDirtyChange?.(e.target.value.trim() !== '');
    setError(null);
  };

  const handlePreview = () => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setError(t('announcements.create.jsonInvalidJson'));
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      setError(t('announcements.create.jsonInvalidJson'));
      return;
    }
    const obj = parsed as Record<string, unknown>;

    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    const message = typeof obj.message === 'string' ? obj.message.trim() : '';
    const linkUrl = typeof obj.link_url === 'string' ? obj.link_url.trim() : '';

    if (!title) {
      setError(t('announcements.create.jsonTitleRequired'));
      return;
    }
    if (title.length > 100) {
      setError(t('announcements.create.jsonTitleTooLong'));
      return;
    }
    if (!message) {
      setError(t('announcements.create.jsonMessageRequired'));
      return;
    }
    if (message.length > 500) {
      setError(t('announcements.create.jsonMessageTooLong'));
      return;
    }
    if (linkUrl) {
      try {
        new URL(linkUrl);
      } catch {
        setError(t('announcements.create.jsonInvalidUrl'));
        return;
      }
      if (linkUrl.length > 500) {
        setError(t('announcements.create.jsonUrlTooLong'));
        return;
      }
    }

    onPreview({ title, message, linkUrl: linkUrl || '' });
  };

  const placeholder = t('announcements.create.jsonPlaceholder');

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('announcements.create.jsonHint')}</p>
      <Textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="min-h-[160px] font-mono text-sm"
        data-testid="announcement-json-textarea"
        disabled={isSubmitting}
      />
      {error && (
        <p className="text-sm text-destructive" data-testid="announcement-json-error">
          {error}
        </p>
      )}
      <Button
        onClick={handlePreview}
        disabled={isSubmitting || !value.trim()}
        data-testid="announcement-json-preview-button"
      >
        {t('announcements.create.preview')}
      </Button>
    </div>
  );
}
