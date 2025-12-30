/**
 * i18n Configuration Tests
 *
 * Tests for i18n initialization, language resources, and translation functionality.
 * These tests verify that:
 * - i18next is configured correctly with fallback language
 * - All supported languages have resources loaded (after lazy loading)
 * - Translation keys return expected values
 * - Language switching works correctly
 *
 * Note: Uses async initI18n() which pre-loads resources based on detected language.
 * Additional languages are loaded via loadLanguageResources() for comprehensive testing.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, NAMESPACES } from '../constants';
import i18n from '../index';
import { initI18n, resetI18nInit } from '../init';
import { loadLanguageResources } from '../lazy-resources';

describe('i18n configuration', () => {
  // Initialize i18n and load all language resources before running tests
  beforeAll(async () => {
    // Reset init state for clean test environment
    resetI18nInit();
    // Initialize i18n (this will detect English from test environment)
    await initI18n();
    // Load remaining languages for comprehensive testing
    await loadLanguageResources('el');
    await loadLanguageResources('ru');
  });

  beforeEach(async () => {
    // Reset to default language before each test
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
  });

  describe('Initialization', () => {
    it('should initialize with correct fallback language', () => {
      expect(i18n.options.fallbackLng).toContain(DEFAULT_LANGUAGE);
    });

    it('should have all supported languages configured', () => {
      const languages = i18n.options.supportedLngs;
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(languages).toContain(lang);
      });
    });

    it('should use common as default namespace', () => {
      expect(i18n.options.defaultNS).toBe('common');
    });

    it('should have all namespaces configured', () => {
      const configuredNS = i18n.options.ns;
      NAMESPACES.forEach((ns) => {
        expect(configuredNS).toContain(ns);
      });
    });
  });

  describe('Resource Bundles', () => {
    it('should have English common namespace loaded', () => {
      expect(i18n.hasResourceBundle('en', 'common')).toBe(true);
    });

    it('should have Greek common namespace loaded', () => {
      expect(i18n.hasResourceBundle('el', 'common')).toBe(true);
    });

    it('should have Russian common namespace loaded', () => {
      expect(i18n.hasResourceBundle('ru', 'common')).toBe(true);
    });

    it('should have all namespaces loaded for English', () => {
      NAMESPACES.forEach((ns) => {
        expect(i18n.hasResourceBundle('en', ns)).toBe(true);
      });
    });

    it('should have all namespaces loaded for Greek', () => {
      NAMESPACES.forEach((ns) => {
        expect(i18n.hasResourceBundle('el', ns)).toBe(true);
      });
    });

    it('should have all namespaces loaded for Russian', () => {
      NAMESPACES.forEach((ns) => {
        expect(i18n.hasResourceBundle('ru', ns)).toBe(true);
      });
    });
  });

  describe('Language Switching', () => {
    it('should change language to Greek successfully', async () => {
      await i18n.changeLanguage('el');
      expect(i18n.language).toBe('el');
    });

    it('should change language to English successfully', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.language).toBe('en');
    });

    it('should change language to Russian successfully', async () => {
      await i18n.changeLanguage('ru');
      expect(i18n.language).toBe('ru');
    });

    it('should maintain language after multiple switches', async () => {
      await i18n.changeLanguage('el');
      expect(i18n.language).toBe('el');

      await i18n.changeLanguage('en');
      expect(i18n.language).toBe('en');

      await i18n.changeLanguage('ru');
      expect(i18n.language).toBe('ru');

      await i18n.changeLanguage('el');
      expect(i18n.language).toBe('el');
    });
  });

  describe('Translations', () => {
    it('should return translation for valid key in English', () => {
      const translation = i18n.t('common:loading');
      expect(translation).toBe('Loading...');
    });

    it('should return translation for valid key in Greek', async () => {
      await i18n.changeLanguage('el');
      const translation = i18n.t('common:loading');
      expect(translation).toBe('Φόρτωση...');
    });

    it('should return translation for valid key in Russian', async () => {
      await i18n.changeLanguage('ru');
      const translation = i18n.t('common:loading');
      expect(translation).toBe('Загрузка...');
    });

    it('should return translation with namespace prefix', () => {
      const translation = i18n.t('nav.dashboard', { ns: 'common' });
      expect(translation).toBe('Dashboard');
    });

    it('should handle interpolation', () => {
      const translation = i18n.t('welcome.greeting', {
        ns: 'common',
        name: 'Test User',
      });
      expect(translation).toContain('Test User');
    });

    it('should return key path for missing translation', () => {
      const result = i18n.t('nonexistent.key');
      // With returnEmptyString: false and returnNull: false, missing keys return the key path
      expect(result).toBe('nonexistent.key');
    });
  });

  describe('Default Language', () => {
    it('should have English as default language constant', () => {
      expect(DEFAULT_LANGUAGE).toBe('en');
    });

    it('should have exactly 3 supported languages', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(3);
    });

    it('should include en, el, and ru in supported languages', () => {
      expect(SUPPORTED_LANGUAGES).toContain('en');
      expect(SUPPORTED_LANGUAGES).toContain('el');
      expect(SUPPORTED_LANGUAGES).toContain('ru');
    });
  });

  describe('Namespaces', () => {
    it('should have all required namespaces', () => {
      const requiredNamespaces = [
        'common',
        'auth',
        'deck',
        'review',
        'settings',
        'profile',
        'statistics',
        'feedback',
      ];

      requiredNamespaces.forEach((ns) => {
        expect(NAMESPACES).toContain(ns);
      });
    });

    it('should access translations from different namespaces', async () => {
      // Ensure we're testing in English
      await i18n.changeLanguage('en');

      // Common namespace
      expect(i18n.t('common:loading')).toBe('Loading...');

      // Auth namespace - note: the app uses Greek greeting for branding
      // "Kalos irthate!" means "Welcome!" in Greek
      expect(i18n.t('auth:login.title')).toBeTruthy();

      // Deck namespace
      expect(i18n.t('deck:list.title')).toBe('Available Decks');

      // Settings namespace
      expect(i18n.t('settings:page.title')).toBe('Settings');
    });
  });
});
