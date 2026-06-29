// Dashboard and metrics type definitions

// Deck types
export interface DeckProgress {
  current: number;
  total: number;
  percentage: number;
}

export interface DeckStats {
  due: number;
  mastered: number;
  learning: number;
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  status: 'in-progress' | 'completed' | 'not-started';
  progress: DeckProgress;
  stats: DeckStats;
  level?: string;
  lastStudied?: Date;
  isCulture?: boolean;
  coverImageUrl?: string;
}
