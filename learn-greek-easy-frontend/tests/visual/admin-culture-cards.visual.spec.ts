/**
 * Admin Culture Cards - Visual Regression Tests
 *
 * Visual regression tests for culture card management modals.
 * Uses Chromatic for visual snapshots and comparison.
 *
 * These tests capture scenarios for:
 * 1. CultureCardForm states (empty, tabs, answers)
 * 2. CardCreateModal states (default, from deck detail, success)
 * 3. CardEditModal states (pre-populated with various answer counts)
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  loginForVisualTest,
  waitForPageReady,
  VIEWPORTS,
} from './helpers/visual-helpers';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockCultureDecks = [
  {
    id: 'deck-001',
    name: 'Greek Traditions',
    category: 'Culture',
    question_count: 25,
    is_active: true,
  },
  {
    id: 'deck-002',
    name: 'Greek History',
    category: 'History',
    question_count: 30,
    is_active: true,
  },
  {
    id: 'deck-003',
    name: 'Greek Geography',
    category: 'Geography',
    question_count: 15,
    is_active: true,
  },
];

const mockCultureQuestionTwoAnswers = {
  id: 'question-001',
  question_text: {
    ru: 'Какой город является столицей Греции?',
    el: 'Ποια είναι η πρωτεύουσα της Ελλάδας;',
    en: 'What is the capital of Greece?',
  },
  option_a: {
    ru: 'Афины',
    el: 'Αθήνα',
    en: 'Athens',
  },
  option_b: {
    ru: 'Салоники',
    el: 'Θεσσαλονίκη',
    en: 'Thessaloniki',
  },
  option_c: null,
  option_d: null,
  correct_option: 1,
  source_article_url: null,
  is_pending_review: false,
  created_at: '2026-01-20T10:00:00Z',
};

const mockCultureQuestionThreeAnswers = {
  id: 'question-002',
  question_text: {
    ru: 'Какой греческий остров самый большой?',
    el: 'Ποιο είναι το μεγαλύτερο ελληνικό νησί;',
    en: 'Which Greek island is the largest?',
  },
  option_a: {
    ru: 'Родос',
    el: 'Ρόδος',
    en: 'Rhodes',
  },
  option_b: {
    ru: 'Крит',
    el: 'Κρήτη',
    en: 'Crete',
  },
  option_c: {
    ru: 'Корфу',
    el: 'Κέρκυρα',
    en: 'Corfu',
  },
  option_d: null,
  correct_option: 2,
  source_article_url: 'https://example.com/article',
  is_pending_review: false,
  created_at: '2026-01-21T10:00:00Z',
};

const mockCultureQuestionFourAnswers = {
  id: 'question-003',
  question_text: {
    ru: 'Когда Греция отмечает День независимости?',
    el: 'Πότε γιορτάζει η Ελλάδα την Ημέρα της Ανεξαρτησίας;',
    en: 'When does Greece celebrate Independence Day?',
  },
  option_a: {
    ru: '25 марта',
    el: '25 Μαρτίου',
    en: 'March 25',
  },
  option_b: {
    ru: '28 октября',
    el: '28 Οκτωβρίου',
    en: 'October 28',
  },
  option_c: {
    ru: '1 января',
    el: '1 Ιανουαρίου',
    en: 'January 1',
  },
  option_d: {
    ru: '15 августа',
    el: '15 Αυγούστου',
    en: 'August 15',
  },
  correct_option: 1,
  source_article_url: null,
  is_pending_review: false,
  created_at: '2026-01-22T10:00:00Z',
};

// ============================================================================
// CARD CREATE MODAL VISUAL TESTS
// ============================================================================

test.describe('CardCreateModal - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up admin authentication for visual tests
    await loginForVisualTest(page);

    // Override role to admin
    await page.evaluate(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authState = JSON.parse(authStorage);
        authState.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(authState));
      }
    });
  });

  // Scenario: CardCreateModal - Default (from action bar with deck dropdown)
  test('CardCreateModal - Default State', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock decks API
    await page.route('**/api/v1/admin/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: [],
          total: 0,
          page: 1,
          page_size: 10,
        }),
      });
    });

    // Mock culture decks for dropdown
    await page.route('**/api/v1/culture/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: mockCultureDecks,
          total: mockCultureDecks.length,
        }),
      });
    });

    // Mock stats API
    await page.route('**/api/v1/admin/stats*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_decks: 10,
          total_cards: 100,
          total_vocabulary_decks: 5,
          total_vocabulary_cards: 50,
          total_culture_decks: 5,
          total_culture_questions: 50,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click add card button (from action bar)
    await page.getByTestId('create-card-button').click();

    // Wait for modal to open
    await expect(page.getByTestId('card-create-modal')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'CardCreateModal - Default State', testInfo);
  });

  // Scenario: CardCreateModal - From Deck Detail (hides deck dropdown)
  test('CardCreateModal - From Deck Detail', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock decks API
    await page.route('**/api/v1/admin/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: [
            {
              id: 'deck-001',
              name: 'Greek Traditions',
              type: 'culture',
              level: null,
              category: 'Culture',
              item_count: 25,
              is_active: true,
              is_premium: false,
              created_at: '2026-01-01T00:00:00Z',
              owner_id: null,
              owner_name: null,
            },
          ],
          total: 1,
          page: 1,
          page_size: 10,
        }),
      });
    });

    // Mock culture questions for deck detail
    await page.route('**/api/v1/admin/culture/decks/deck-001/questions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          questions: [mockCultureQuestionFourAnswers],
          total: 1,
          page: 1,
          page_size: 20,
          deck_id: 'deck-001',
        }),
      });
    });

    // Mock stats API
    await page.route('**/api/v1/admin/stats*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_decks: 10,
          total_cards: 100,
          total_vocabulary_decks: 5,
          total_vocabulary_cards: 50,
          total_culture_decks: 5,
          total_culture_questions: 50,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on deck row to open detail modal
    await page.getByTestId('deck-row-deck-001').click();

    // Wait for deck detail modal
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Click add card button within deck detail
    await page.getByTestId('create-card-btn').click();

    // Wait for card create modal (deck detail should close, card create should open)
    await expect(page.getByTestId('card-create-modal')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'CardCreateModal - From Deck Detail', testInfo);
  });

  // Scenario: CardCreateModal - All Tabs Complete (filled form)
  test('CardCreateModal - All Tabs Complete', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock culture decks for dropdown
    await page.route('**/api/v1/culture/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: mockCultureDecks,
          total: mockCultureDecks.length,
        }),
      });
    });

    // Mock decks API
    await page.route('**/api/v1/admin/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: [],
          total: 0,
          page: 1,
          page_size: 10,
        }),
      });
    });

    // Mock stats API
    await page.route('**/api/v1/admin/stats*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_decks: 10,
          total_cards: 100,
          total_vocabulary_decks: 5,
          total_vocabulary_cards: 50,
          total_culture_decks: 5,
          total_culture_questions: 50,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click add card button
    await page.getByTestId('create-card-button').click();
    await expect(page.getByTestId('card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Select a deck
    await page.getByTestId('deck-select').click();
    await page.getByRole('option', { name: 'Greek Traditions' }).click();

    // Fill Russian tab
    await page.getByTestId('question-input-ru').fill('Какой город является столицей Греции?');
    await page.getByTestId('answer-input-A-ru').fill('Афины');
    await page.getByTestId('answer-input-B-ru').fill('Салоники');

    // Switch to Greek tab and fill
    await page.getByTestId('lang-tab-el').click();
    await page.getByTestId('question-input-el').fill('Ποια είναι η πρωτεύουσα της Ελλάδας;');
    await page.getByTestId('answer-input-A-el').fill('Αθήνα');
    await page.getByTestId('answer-input-B-el').fill('Θεσσαλονίκη');

    // Switch to English tab and fill
    await page.getByTestId('lang-tab-en').click();
    await page.getByTestId('question-input-en').fill('What is the capital of Greece?');
    await page.getByTestId('answer-input-A-en').fill('Athens');
    await page.getByTestId('answer-input-B-en').fill('Thessaloniki');

    // Select correct answer
    await page.getByTestId('correct-radio-A-en').click();

    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardCreateModal - All Tabs Complete', testInfo);
  });

  // Scenario: CardCreateModal - Incomplete Tab Indicators
  test('CardCreateModal - Incomplete Tab Indicators', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock culture decks for dropdown
    await page.route('**/api/v1/culture/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: mockCultureDecks,
          total: mockCultureDecks.length,
        }),
      });
    });

    // Mock decks API
    await page.route('**/api/v1/admin/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: [],
          total: 0,
          page: 1,
          page_size: 10,
        }),
      });
    });

    // Mock stats API
    await page.route('**/api/v1/admin/stats*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_decks: 10,
          total_cards: 100,
          total_vocabulary_decks: 5,
          total_vocabulary_cards: 50,
          total_culture_decks: 5,
          total_culture_questions: 50,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click add card button
    await page.getByTestId('create-card-button').click();
    await expect(page.getByTestId('card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Select a deck
    await page.getByTestId('deck-select').click();
    await page.getByRole('option', { name: 'Greek Traditions' }).click();

    // Fill only Russian tab (EL and EN tabs should show incomplete indicators)
    await page.getByTestId('question-input-ru').fill('Какой город является столицей Греции?');
    await page.getByTestId('answer-input-A-ru').fill('Афины');
    await page.getByTestId('answer-input-B-ru').fill('Салоники');

    // Click on Greek tab to show the incomplete indicators on other tabs
    await page.getByTestId('lang-tab-el').click();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardCreateModal - Incomplete Tab Indicators', testInfo);
  });

  // Scenario: CardCreateModal - Four Answers State
  test('CardCreateModal - Four Answers', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock culture decks for dropdown
    await page.route('**/api/v1/culture/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: mockCultureDecks,
          total: mockCultureDecks.length,
        }),
      });
    });

    // Mock decks API
    await page.route('**/api/v1/admin/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: [],
          total: 0,
          page: 1,
          page_size: 10,
        }),
      });
    });

    // Mock stats API
    await page.route('**/api/v1/admin/stats*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_decks: 10,
          total_cards: 100,
          total_vocabulary_decks: 5,
          total_vocabulary_cards: 50,
          total_culture_decks: 5,
          total_culture_questions: 50,
        }),
      });
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click add card button
    await page.getByTestId('create-card-button').click();
    await expect(page.getByTestId('card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Add two more answers (start with 2, add to get 4)
    await page.getByTestId('add-answer-btn').click();
    await page.getByTestId('add-answer-btn').click();

    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardCreateModal - Four Answers', testInfo);
  });

  // Scenario: CardCreateModal - Success State
  test('CardCreateModal - Success State', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock culture decks for dropdown
    await page.route('**/api/v1/culture/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: mockCultureDecks,
          total: mockCultureDecks.length,
        }),
      });
    });

    // Mock decks API
    await page.route('**/api/v1/admin/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: [],
          total: 0,
          page: 1,
          page_size: 10,
        }),
      });
    });

    // Mock stats API
    await page.route('**/api/v1/admin/stats*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_decks: 10,
          total_cards: 100,
          total_vocabulary_decks: 5,
          total_vocabulary_cards: 50,
          total_culture_decks: 5,
          total_culture_questions: 50,
        }),
      });
    });

    // Mock create question API
    await page.route('**/api/v1/culture/questions', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-question-001',
            deck_id: 'deck-001',
            question_text: { ru: 'Test', el: 'Test', en: 'Test' },
            option_a: { ru: 'A', el: 'A', en: 'A' },
            option_b: { ru: 'B', el: 'B', en: 'B' },
            option_c: null,
            option_d: null,
            correct_option: 1,
            option_count: 2,
            image_key: null,
            order_index: 0,
            created_at: '2026-01-28T10:00:00Z',
            updated_at: '2026-01-28T10:00:00Z',
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click add card button
    await page.getByTestId('create-card-button').click();
    await expect(page.getByTestId('card-create-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Select a deck
    await page.getByTestId('deck-select').click();
    await page.getByRole('option', { name: 'Greek Traditions' }).click();

    // Fill all languages
    // Russian
    await page.getByTestId('question-input-ru').fill('Test question');
    await page.getByTestId('answer-input-A-ru').fill('Answer A');
    await page.getByTestId('answer-input-B-ru').fill('Answer B');

    // Greek
    await page.getByTestId('lang-tab-el').click();
    await page.getByTestId('question-input-el').fill('Test question');
    await page.getByTestId('answer-input-A-el').fill('Answer A');
    await page.getByTestId('answer-input-B-el').fill('Answer B');

    // English
    await page.getByTestId('lang-tab-en').click();
    await page.getByTestId('question-input-en').fill('Test question');
    await page.getByTestId('answer-input-A-en').fill('Answer A');
    await page.getByTestId('answer-input-B-en').fill('Answer B');

    // Select correct answer
    await page.getByTestId('correct-radio-A-en').click();

    // Submit
    await page.getByTestId('create-btn').click();

    // Wait for success state
    await expect(page.getByTestId('create-another-btn')).toBeVisible();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardCreateModal - Success State', testInfo);
  });
});

// ============================================================================
// CARD EDIT MODAL VISUAL TESTS
// ============================================================================

test.describe('CardEditModal - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up admin authentication for visual tests
    await loginForVisualTest(page);

    // Override role to admin
    await page.evaluate(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authState = JSON.parse(authStorage);
        authState.state.user.role = 'admin';
        localStorage.setItem('auth-storage', JSON.stringify(authState));
      }
    });
  });

  // Helper to set up deck detail page with questions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function setupDeckDetailWithQuestions(
    page: any,
    questions: (typeof mockCultureQuestionFourAnswers)[]
  ) {
    // Mock decks API
    await page.route('**/api/v1/admin/decks*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: [
            {
              id: 'deck-001',
              name: 'Greek Traditions',
              type: 'culture',
              level: null,
              category: 'Culture',
              item_count: questions.length,
              is_active: true,
              is_premium: false,
              created_at: '2026-01-01T00:00:00Z',
              owner_id: null,
              owner_name: null,
            },
          ],
          total: 1,
          page: 1,
          page_size: 10,
        }),
      });
    });

    // Mock culture questions for deck detail
    await page.route('**/api/v1/admin/culture/decks/deck-001/questions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          questions,
          total: questions.length,
          page: 1,
          page_size: 20,
          deck_id: 'deck-001',
        }),
      });
    });

    // Mock stats API
    await page.route('**/api/v1/admin/stats*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_decks: 10,
          total_cards: 100,
          total_vocabulary_decks: 5,
          total_vocabulary_cards: 50,
          total_culture_decks: 5,
          total_culture_questions: 50,
        }),
      });
    });
  }

  // Scenario: CardEditModal - Default (Two Answers)
  test('CardEditModal - Two Answers', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await setupDeckDetailWithQuestions(page, [mockCultureQuestionTwoAnswers]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on deck row to open detail modal
    await page.getByTestId('deck-row-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Click edit on first question
    await page.getByTestId('edit-question-question-001').click();

    // Wait for edit modal
    await expect(page.getByTestId('card-edit-modal')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'CardEditModal - Two Answers', testInfo);
  });

  // Scenario: CardEditModal - Three Answers
  test('CardEditModal - Three Answers', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await setupDeckDetailWithQuestions(page, [mockCultureQuestionThreeAnswers]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on deck row to open detail modal
    await page.getByTestId('deck-row-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Click edit on first question
    await page.getByTestId('edit-question-question-002').click();

    // Wait for edit modal
    await expect(page.getByTestId('card-edit-modal')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'CardEditModal - Three Answers', testInfo);
  });

  // Scenario: CardEditModal - Four Answers
  test('CardEditModal - Four Answers', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await setupDeckDetailWithQuestions(page, [mockCultureQuestionFourAnswers]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on deck row to open detail modal
    await page.getByTestId('deck-row-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Click edit on first question
    await page.getByTestId('edit-question-question-003').click();

    // Wait for edit modal
    await expect(page.getByTestId('card-edit-modal')).toBeVisible();
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'CardEditModal - Four Answers', testInfo);
  });

  // Scenario: CardEditModal - Greek Tab View
  test('CardEditModal - Greek Tab View', async ({ page }, testInfo) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await setupDeckDetailWithQuestions(page, [mockCultureQuestionFourAnswers]);

    await page.goto('/admin');
    await waitForPageReady(page, '[data-testid="admin-page"]');

    // Click on deck row to open detail modal
    await page.getByTestId('deck-row-deck-001').click();
    await expect(page.getByTestId('deck-detail-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Click edit on first question
    await page.getByTestId('edit-question-question-003').click();

    // Wait for edit modal
    await expect(page.getByTestId('card-edit-modal')).toBeVisible();
    await page.waitForTimeout(300);

    // Switch to Greek tab
    await page.getByTestId('lang-tab-el').click();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'CardEditModal - Greek Tab View', testInfo);
  });
});
