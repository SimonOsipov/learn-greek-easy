/**
 * i18n Configuration Tests
 *
 * Tests for i18n initialization, language resources, and translation functionality.
 * These tests verify that:
 * - i18next is configured correctly with fallback language
 * - All supported languages have resources loaded
 * - Translation keys return expected values
 * - Language switching works correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';

import i18n from '../index';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, NAMESPACES } from '../constants';

describe('i18n configuration', () => {
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

    it('should maintain language after multiple switches', async () => {
      await i18n.changeLanguage('el');
      expect(i18n.language).toBe('el');

      await i18n.changeLanguage('en');
      expect(i18n.language).toBe('en');

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

    it('should have exactly 2 supported languages', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(2);
    });

    it('should include en and el in supported languages', () => {
      expect(SUPPORTED_LANGUAGES).toContain('en');
      expect(SUPPORTED_LANGUAGES).toContain('el');
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
