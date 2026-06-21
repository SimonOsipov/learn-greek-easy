import React from 'react';

import { useTranslation } from 'react-i18next';

import { Kicker } from '@/components/ui/kicker';
import type { NewsItemResponse } from '@/services/adminAPI';

interface Props {
  item: NewsItemResponse;
}

export const NewsEditDrawerImage: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation('admin');

  return (
    <div className="dr-image-tab" data-testid="news-drawer-tab-image-content">
      {/* Left: 4:3 preview + bottom-aligned overlay */}
      <div className="dr-image-preview">
        <div className="dr-image-box">
          {item.image_url ? (
            <img src={item.image_url} alt={item.alt_text ?? ''} />
          ) : (
            <div className="dr-image-fallback" />
          )}
        </div>
        <div className="dr-image-overlay">
          <Kicker dot="primary">{t('news.drawer.image.kicker')}</Kicker>
        </div>
      </div>
    </div>
  );
};
