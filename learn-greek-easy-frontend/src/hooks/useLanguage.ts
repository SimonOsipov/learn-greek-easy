/**
 * useLanguage Hook
 *
 * Re-exported from LanguageContext for convenient imports.
 * Provides access to language state and change functionality.
 *
 * @example
 * ```tsx
 * import { useLanguage } from '@/hooks/useLanguage';
 *
 * function MyComponent() {
 *   const { currentLanguage, changeLanguage } = useLanguage();
 *   // ...
 * }
 * ```
 */
export { useLanguage } from '@/contexts/LanguageContext';
export type { LanguageContextValue } from '@/contexts/LanguageContext';
