// Barrel export for all type definitions
import type { ReactNode } from 'react';

// Export auth types explicitly
export type {
  UserRole,
  UserPreferences,
  UserStats,
  User,
  RegisterData,
  AuthResponse,
  AuthError,
} from './auth';

// Export dashboard types explicitly
export type {
  DashboardMetrics,
  WeeklyProgress,
  ActivityItem,
  UpcomingReview,
  LearningStatistics,
  Metric,
  DeckProgress,
  DeckStats,
  Deck,
  DashboardUser,
  DashboardData,
} from './dashboard';

// Component prop types (to be expanded as components are built)
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface LoadableComponentProps {
  loading?: boolean;
  error?: Error | null;
}
