// src/components/admin/announcements/AnnouncementNotificationPreview.tsx

/**
 * AnnouncementNotificationPreview
 *
 * Pure presentational component. Renders a phone-style notification preview
 * card plus three static meta tiles (Audience / Delivery / Channel).
 *
 * No state, no effects, no business logic.
 */

import { useTranslation } from 'react-i18next';

interface AnnouncementNotificationPreviewProps {
  title: string;
  message: string;
  linkUrl?: string;
}

export function AnnouncementNotificationPreview({
  title,
  message,
  linkUrl,
}: AnnouncementNotificationPreviewProps) {
  const { t } = useTranslation('admin');

  const displayTitle =
    title.trim().length > 0 ? title : t('announcements.v2.preview.titlePlaceholder');
  const displayMessage =
    message.trim().length > 0 ? message : t('announcements.v2.preview.messagePlaceholder');
  const showLink = typeof linkUrl === 'string' && linkUrl.trim().length > 0;

  return (
    <div className="an-preview">
      <div className="an-preview-l">{t('announcements.v2.preview.label')}</div>

      <div className="an-preview-card" data-testid="announcement-preview-card">
        <div className="an-preview-icon">Ελ</div>
        <div className="an-preview-body">
          <div className="an-preview-app">Greeklish</div>
          <div className="an-preview-title" data-testid="announcement-preview-card-title">
            {displayTitle}
          </div>
          <div className="an-preview-msg" data-testid="announcement-preview-card-message">
            {displayMessage}
          </div>
          {showLink && <div className="an-preview-link">{linkUrl}</div>}
          <div className="an-preview-time">now</div>
        </div>
      </div>

      <div className="an-preview-meta">
        <div>
          <span>{t('announcements.v2.preview.meta.audienceLabel')}</span>
          <b>{t('announcements.v2.preview.meta.audienceValue')}</b>
        </div>
        <div>
          <span>{t('announcements.v2.preview.meta.deliveryLabel')}</span>
          <b>{t('announcements.v2.preview.meta.deliveryValue')}</b>
        </div>
        <div>
          <span>{t('announcements.v2.preview.meta.channelLabel')}</span>
          <b>{t('announcements.v2.preview.meta.channelValue')}</b>
        </div>
      </div>
    </div>
  );
}
