// Barrel export for all type definitions
import type { ReactNode } from 'react';

// Export only dashboard types to avoid duplicates
// (dashboard.ts includes its own Deck and User definitions)
export * from './dashboard';

// Component prop types (to be expanded as components are built)
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface LoadableComponentProps {
  loading?: boolean;
  error?: Error | null;
}
