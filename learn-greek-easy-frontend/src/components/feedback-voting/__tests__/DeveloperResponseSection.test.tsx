/**
 * DeveloperResponseSection Component Tests
 *
 * Tests for the DeveloperResponseSection component verifying:
 * - Correct rendering of response text
 * - Translation of the "Developer Response" title
 * - Relative timestamp formatting
 * - Proper styling with blue theme
 * - Whitespace preservation for multiline responses
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DeveloperResponseSection } from '../DeveloperResponseSection';

// Mock English translations
const enFeedback = {
  developerResponse: {
    title: 'Developer Response',
  },
};

// Mock Greek translations
const elFeedback = {
  developerResponse: {
    title: 'Απάντηση Προγραμματιστή',
  },
};

// Mock Russian translations
const ruFeedback = {
  developerResponse: {
    title: 'Ответ разработчика',
  },
};

// Setup i18n for tests with multiple languages
const setupI18n = (language: string = 'en') => {
  const testI18n = i18n.createInstance();
  testI18n.use(initReactI18next).init({
    resources: {
      en: { feedback: enFeedback },
      el: { feedback: elFeedback },
      ru: { feedback: ruFeedback },
    },
    lng: language,
    fallbackLng: 'en',
    ns: ['feedback'],
    defaultNS: 'feedback',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return testI18n;
};

const renderWithI18n = (ui: React.ReactElement, language: string = 'en') => {
  const testI18n = setupI18n(language);
  return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>);
};

describe('DeveloperResponseSection', () => {
  const defaultProps = {
    response: 'Thank you for your feedback. We will look into this issue.',
    respondedAt: '2026-01-10T12:00:00Z',
  };

  describe('Basic Rendering', () => {
    it('should render the response text correctly', () => {
      renderWithI18n(<DeveloperResponseSection {...defaultProps} />);

      expect(
        screen.getByText('Thank you for your feedback. We will look into this issue.')
      ).toBeInTheDocument();
    });

    it('should render the "Developer Response" title', () => {
      renderWithI18n(<DeveloperResponseSection {...defaultProps} />);

      expect(screen.getByText('Developer Response')).toBeInTheDocument();
    });

    it('should have the developer-response-section data-testid', () => {
      renderWithI18n(<DeveloperResponseSection {...defaultProps} />);

      expect(screen.getByTestId('developer-response-section')).toBeInTheDocument();
    });

    it('should have the developer-response-text data-testid on the response text', () => {
      renderWithI18n(<DeveloperResponseSection {...defaultProps} />);

      const responseText = screen.getByTestId('developer-response-text');
      expect(responseText).toBeInTheDocument();
      expect(responseText).toHaveTextContent(defaultProps.response);
    });
  });

  describe('Timestamp Formatting', () => {
    it('should format the timestamp as relative time', () => {
      const recentDate = new Date().toISOString();
      renderWithI18n(
        <DeveloperResponseSection response="Test response" respondedAt={recentDate} />
      );

      // Should show something like "less than a minute ago" for recent timestamps
      const expectedTime = formatDistanceToNow(new Date(recentDate), { addSuffix: true });
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });

    it('should format timestamp with Greek locale when language is Greek', () => {
      const testDate = '2026-01-09T12:00:00Z';
      renderWithI18n(
        <DeveloperResponseSection response="Test response" respondedAt={testDate} />,
        'el'
      );

      const expectedTime = formatDistanceToNow(new Date(testDate), {
        addSuffix: true,
        locale: el,
      });
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });

    it('should format timestamp with Russian locale when language is Russian', () => {
      const testDate = '2026-01-09T12:00:00Z';
      renderWithI18n(
        <DeveloperResponseSection response="Test response" respondedAt={testDate} />,
        'ru'
      );

      const expectedTime = formatDistanceToNow(new Date(testDate), {
        addSuffix: true,
        locale: ru,
      });
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have blue-themed border styling', () => {
      renderWithI18n(<DeveloperResponseSection {...defaultProps} />);

      const section = screen.getByTestId('developer-response-section');
      expect(section).toHaveClass('border-blue-200');
      expect(section).toHaveClass('bg-blue-50');
    });

    it('should have whitespace-pre-wrap class for multiline responses', () => {
      renderWithI18n(<DeveloperResponseSection {...defaultProps} />);

      const responseText = screen.getByTestId('developer-response-text');
      expect(responseText).toHaveClass('whitespace-pre-wrap');
    });

    it('should preserve whitespace in multiline responses via CSS', () => {
      const multilineResponse = 'Line 1\nLine 2\n\nLine 4 after blank line';
      renderWithI18n(
        <DeveloperResponseSection
          response={multilineResponse}
          respondedAt={defaultProps.respondedAt}
        />
      );

      const responseText = screen.getByTestId('developer-response-text');
      // The whitespace-pre-wrap CSS class ensures multiline text displays correctly
      // toHaveTextContent normalizes whitespace, so we check the class is present instead
      expect(responseText).toHaveClass('whitespace-pre-wrap');
      // Verify the text contains the content (normalized by testing library)
      expect(responseText.textContent).toContain('Line 1');
      expect(responseText.textContent).toContain('Line 2');
      expect(responseText.textContent).toContain('Line 4 after blank line');
    });
  });

  describe('Translation - Language Switching', () => {
    it('should display translated title in Greek', () => {
      renderWithI18n(<DeveloperResponseSection {...defaultProps} />, 'el');

      expect(screen.getByText('Απάντηση Προγραμματιστή')).toBeInTheDocument();
    });

    it('should display translated title in Russian', () => {
      renderWithI18n(<DeveloperResponseSection {...defaultProps} />, 'ru');

      expect(screen.getByText('Ответ разработчика')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should render empty response gracefully', () => {
      renderWithI18n(
        <DeveloperResponseSection response="" respondedAt={defaultProps.respondedAt} />
      );

      const responseText = screen.getByTestId('developer-response-text');
      expect(responseText).toHaveTextContent('');
    });

    it('should handle long response text', () => {
      const longResponse = 'A'.repeat(1000);
      renderWithI18n(
        <DeveloperResponseSection response={longResponse} respondedAt={defaultProps.respondedAt} />
      );

      const responseText = screen.getByTestId('developer-response-text');
      expect(responseText).toHaveTextContent(longResponse);
    });

    it('should handle special characters in response', () => {
      const specialResponse = '<script>alert("xss")</script> & special "chars"';
      renderWithI18n(
        <DeveloperResponseSection
          response={specialResponse}
          respondedAt={defaultProps.respondedAt}
        />
      );

      const responseText = screen.getByTestId('developer-response-text');
      expect(responseText).toHaveTextContent(specialResponse);
    });
  });
});
