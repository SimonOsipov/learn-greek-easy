import React from 'react';

import { type NewsItemResponse } from '@/services/adminAPI';

export const NewsEditDrawerAudio: React.FC<{ item: NewsItemResponse }> = () => (
  <div data-testid="news-drawer-tab-audio-content">Audio tab — NEWS-07c</div>
);
