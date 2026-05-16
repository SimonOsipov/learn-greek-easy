import React from 'react';

import { type NewsItemResponse } from '@/services/adminAPI';

export const NewsEditDrawerTranslations: React.FC<{ item: NewsItemResponse }> = () => (
  <div data-testid="news-drawer-tab-translations-content">Translations tab — NEWS-07a</div>
);
