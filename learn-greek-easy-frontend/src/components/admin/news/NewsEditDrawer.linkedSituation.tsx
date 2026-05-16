import React from 'react';

import { type NewsItemResponse } from '@/services/adminAPI';

export const NewsEditDrawerLinkedSituation: React.FC<{ item: NewsItemResponse }> = () => (
  <div data-testid="news-drawer-tab-linkedSituation-content">Linked situation tab — NEWS-07e</div>
);
