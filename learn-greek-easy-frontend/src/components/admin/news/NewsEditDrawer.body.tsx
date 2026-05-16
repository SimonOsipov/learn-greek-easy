import React from 'react';

import { type NewsItemResponse } from '@/services/adminAPI';

export const NewsEditDrawerBody: React.FC<{ item: NewsItemResponse }> = () => (
  <div data-testid="news-drawer-tab-body-content">Body tab — NEWS-07b</div>
);
