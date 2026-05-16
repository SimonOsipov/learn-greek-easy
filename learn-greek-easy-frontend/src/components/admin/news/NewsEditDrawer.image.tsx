import React from 'react';

import { type NewsItemResponse } from '@/services/adminAPI';

export const NewsEditDrawerImage: React.FC<{ item: NewsItemResponse }> = () => (
  <div data-testid="news-drawer-tab-image-content">Image tab — NEWS-07d</div>
);
