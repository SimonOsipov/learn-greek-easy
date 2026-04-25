// Dashboard and metrics type definitions

// Test dashboard metric types
export interface Metric {
  id: string;
  label: string;
  value: number | string;
  sublabel: string;
  color?: 'primary' | 'orange' | 'green' | 'blue' | 'muted';
  icon?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

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
