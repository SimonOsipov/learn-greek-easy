/**
 * i18n module exports.
 *
 * This module re-exports the i18n instance and related constants/types.
 * Actual initialization happens in init.ts via initI18n().
 *
 * IMPORTANT: Import from '@/i18n/init' and call initI18n() before using i18n.
 * The async initialization ensures proper language detection and resource loading.
 *
 * @module i18n
 */

import i18n from 'i18next';

// Re-export i18n instance for convenience
export { i18n };
export default i18n;

// Re-export types and constants
export * from './constants';
export * from './types';
