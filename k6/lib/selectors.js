/**
 * K6 Selectors Library
 *
 * Contains all data-testid selectors organized by feature area.
 * These selectors match the data-testid attributes used in the frontend
 * for consistent test targeting across Playwright E2E and k6 performance tests.
 *
 * Also includes API endpoint paths for HTTP performance testing.
 */

/**
 * Helper function to create a data-testid selector string.
 *
 * @param {string} id - The data-testid value
 * @returns {string} CSS selector string
 * @example
 * testId('login-card') // Returns '[data-testid="login-card"]'
 */
export function testId(id) {
  return `[data-testid="${id}"]`;
}

// =============================================================================
// UI Selectors by Feature Area
// =============================================================================

/**
 * Authentication-related selectors
 */
export const auth = {
  // Login page
  loginCard: 'login-card',
  loginForm: 'login-form',
  loginTitle: 'login-title',
  loginDescription: 'login-description',
  loginSubmit: 'login-submit',
  loginLink: 'login-link',

  // Register page
  registerCard: 'register-card',
  registerForm: 'register-form',
  registerTitle: 'register-title',
  registerDescription: 'register-description',
  registerSubmit: 'register-submit',
  registerLink: 'register-link',

  // Shared form inputs
  emailInput: 'email-input',
  passwordInput: 'password-input',
  confirmPasswordInput: 'confirm-password-input',
  nameInput: 'name-input',

  // Loading states
  pageLoader: 'page-loader',
  authLoading: 'auth-loading',

  // Google auth
  googleSigninButton: 'google-signin-button',

  // Logout
  logoutButton: 'logout-button',
  logoutDialog: 'logout-dialog',
  logoutConfirmButton: 'logout-confirm-button',
};

/**
 * Navigation and header selectors
 */
export const navigation = {
  userMenuTrigger: 'user-menu-trigger',
  statisticsDropdownTrigger: 'statistics-dropdown-trigger',
  languageSwitcherTrigger: 'language-switcher-trigger',
  languageSelector: 'language-selector',
};

/**
 * Dashboard page selectors
 */
export const dashboard = {
  dashboard: 'dashboard',
  dashboardTitle: 'dashboard-title',
  activityItem: 'activity-item',
};

/**
 * Deck browsing and detail selectors
 */
export const decks = {
  // Deck list
  decksTitle: 'decks-title',
  deckCard: 'deck-card',
  deckCardTitle: 'deck-card-title',
  deckCardHeader: 'deck-card-header',
  deckCardContent: 'deck-card-content',
  deckCardStats: 'deck-card-stats',
  deckProgress: 'deck-progress',
  deckCategoryBadge: 'deck-category-badge',

  // Deck detail
  deckDetail: 'deck-detail',
  breadcrumb: 'breadcrumb',
  startReviewButton: 'start-review-button',
};

/**
 * Flashcard review selectors
 */
export const flashcards = {
  flashcard: 'flashcard',
};

/**
 * Culture deck and practice selectors
 */
export const culture = {
  cultureBadge: 'culture-badge',
  startPracticeButton: 'start-practice-button',
  exitButton: 'exit-button',

  // MCQ (Multiple Choice Question) component
  mcq: {
    component: 'mcq-component',
    progress: 'mcq-progress',
    image: 'mcq-image',
    questionText: 'mcq-question-text',
    options: 'mcq-options',
    submitButton: 'mcq-submit-button',
    keyboardHint: 'mcq-keyboard-hint',
    selectHint: 'mcq-select-hint',
  },
};

/**
 * Helper to get answer option selector by letter (A, B, C, D)
 *
 * @param {string} letter - The answer option letter
 * @returns {string} The data-testid value
 */
export function answerOption(letter) {
  return `answer-option-${letter.toLowerCase()}`;
}

/**
 * Admin dashboard selectors
 */
export const admin = {
  adminPage: 'admin-page',
  adminTitle: 'admin-title',
  adminSubtitle: 'admin-subtitle',

  // Deck management
  decksByLevelTitle: 'decks-by-level-title',
  decksByLevelDescription: 'decks-by-level-description',
  cultureDecksTitle: 'culture-decks-title',
  cultureDecksDescription: 'culture-decks-description',

  // All decks list
  allDecksTitle: 'all-decks-title',
  allDecksDescription: 'all-decks-description',
  deckSearchInput: 'deck-search-input',
  typeFilterSelect: 'type-filter-select',

  // Pagination
  paginationPrev: 'pagination-prev',
  paginationNext: 'pagination-next',

  // Deck edit modal
  deckEditModal: 'deck-edit-modal',
  vocabularyDeckEditForm: 'vocabulary-deck-edit-form',
  cultureDeckEditForm: 'culture-deck-edit-form',
  deckEditName: 'deck-edit-name',
  deckEditDescription: 'deck-edit-description',
  deckEditLevel: 'deck-edit-level',
  deckEditCategory: 'deck-edit-category',
  deckEditIsActive: 'deck-edit-is-active',
  deckEditCancel: 'deck-edit-cancel',
  deckEditSave: 'deck-edit-save',

  // Deactivation warning
  deactivationWarningDialog: 'deactivation-warning-dialog',
  deactivationCancel: 'deactivation-cancel',
  deactivationConfirm: 'deactivation-confirm',
};

/**
 * Helper to get edit deck button selector by deck ID
 *
 * @param {string|number} deckId - The deck ID
 * @returns {string} The data-testid value
 */
export function editDeckButton(deckId) {
  return `edit-deck-${deckId}`;
}

/**
 * Landing page selectors
 */
export const landing = {
  landingPage: 'landing-page',
  landingHeader: 'landing-header',
  landingNav: 'landing-nav',
  landingLanguageSwitcher: 'landing-language-switcher',
  landingLoginButton: 'landing-login-button',
  landingGetStartedButton: 'landing-get-started-button',
  landingFooter: 'landing-footer',
  footerLinks: 'footer-links',
  greekPattern: 'greek-pattern',
  navLink: 'nav-link',

  // Hero section
  hero: {
    section: 'hero-section',
    title: 'hero-title',
    subtitle: 'hero-subtitle',
    ctaButton: 'hero-cta-button',
  },

  // Features section
  features: {
    section: 'features-section',
    card: 'feature-card',
  },

  // Social proof section
  socialProof: {
    section: 'social-proof-section',
  },

  // Pricing section
  pricing: {
    section: 'pricing-section',
    card: 'pricing-card',
    cta: 'pricing-cta',
  },

  // FAQ section
  faq: {
    section: 'faq-section',
    item: 'faq-item',
  },

  // Final CTA section
  finalCta: {
    section: 'final-cta-section',
  },
};

/**
 * Profile page selectors
 */
export const profile = {
  profilePage: 'profile-page',

  // Security section
  securitySection: 'security-section',
  changePasswordButton: 'change-password-button',
  passwordDialog: 'password-dialog',
  passwordChangeTitle: 'password-change-title',
  passwordChangeForm: 'password-change-form',
  currentPasswordInput: 'current-password-input',
  newPasswordInput: 'new-password-input',
  passwordChangeCancel: 'password-change-cancel',
  passwordChangeSubmit: 'password-change-submit',

  // Preferences section
  preferencesSection: 'preferences-section',
  preferencesSaving: 'preferences-saving',
  dailyGoalCard: 'daily-goal-card',
  dailyGoalValue: 'daily-goal-value',
  dailyGoalIntensity: 'daily-goal-intensity',
  dailyGoalSlider: 'daily-goal-slider',
};

/**
 * Statistics page selectors
 */
export const statistics = {
  statisticsPage: 'statistics-page',
};

/**
 * Achievements page selectors
 */
export const achievements = {
  achievementsPage: 'achievements-page',
};

/**
 * Feedback page selectors
 */
export const feedback = {
  feedbackPage: 'feedback-page',
  feedbackPageTitle: 'feedback-page-title',
  feedbackError: 'feedback-error',
  openSubmitDialogButton: 'open-submit-dialog-button',

  // Feedback list
  feedbackList: 'feedback-list',
  feedbackCard: 'feedback-card',
  feedbackTitle: 'feedback-title',
  feedbackMeta: 'feedback-meta',
  feedbackDescription: 'feedback-description',
  feedbackEmptyState: 'feedback-empty-state',
  feedbackPagination: 'feedback-pagination',
  paginationPrev: 'pagination-prev',
  paginationNext: 'pagination-next',
  paginationInfo: 'pagination-info',

  // Filters
  feedbackFilters: 'feedback-filters',
  categoryFilter: 'category-filter',
  statusFilter: 'status-filter',
  sortFilter: 'sort-filter',
  clearFiltersButton: 'clear-filters-button',
};

/**
 * Error page selectors
 */
export const errors = {
  notFoundPage: 'not-found-page',
};

// =============================================================================
// API Endpoints for HTTP Testing
// =============================================================================

/**
 * API endpoint paths for HTTP performance testing.
 * All paths are relative to the API base URL (/api/v1).
 */
export const apiEndpoints = {
  // Health check (no auth required)
  health: '/health',
  healthz: '/healthz',

  // Authentication
  auth: {
    register: '/api/v1/auth/register',
    login: '/api/v1/auth/login',
    google: '/api/v1/auth/google',
    refresh: '/api/v1/auth/refresh',
    logout: '/api/v1/auth/logout',
    logoutAll: '/api/v1/auth/logout-all',
    me: '/api/v1/auth/me',
    sessions: '/api/v1/auth/sessions',
  },

  // Decks
  decks: {
    list: '/api/v1/decks',
    detail: (id) => `/api/v1/decks/${id}`,
    cards: (id) => `/api/v1/decks/${id}/cards`,
  },

  // Cards
  cards: {
    list: '/api/v1/cards',
    detail: (id) => `/api/v1/cards/${id}`,
  },

  // Reviews
  reviews: {
    submit: '/api/v1/reviews',
    history: '/api/v1/reviews/history',
  },

  // Study
  study: {
    session: '/api/v1/study/session',
    due: '/api/v1/study/due',
  },

  // Progress
  progress: {
    summary: '/api/v1/progress/summary',
    daily: '/api/v1/progress/daily',
    weekly: '/api/v1/progress/weekly',
  },

  // XP and Achievements
  xp: {
    summary: '/api/v1/xp/summary',
    history: '/api/v1/xp/history',
    achievements: '/api/v1/xp/achievements',
    leaderboard: '/api/v1/xp/leaderboard',
  },

  // Culture
  culture: {
    decks: '/api/v1/culture/decks',
    deckDetail: (id) => `/api/v1/culture/decks/${id}`,
    questions: (deckId) => `/api/v1/culture/decks/${deckId}/questions`,
    submitAnswer: '/api/v1/culture/answers',
    progress: (deckId) => `/api/v1/culture/decks/${deckId}/progress`,
  },

  // Notifications
  notifications: {
    list: '/api/v1/notifications',
    markRead: (id) => `/api/v1/notifications/${id}/read`,
    markAllRead: '/api/v1/notifications/read-all',
  },

  // Feedback
  feedback: {
    list: '/api/v1/feedback',
    submit: '/api/v1/feedback',
    vote: (id) => `/api/v1/feedback/${id}/vote`,
  },

  // Admin
  admin: {
    stats: '/api/v1/admin/stats',
    users: '/api/v1/admin/users',
    decks: '/api/v1/admin/decks',
    updateDeck: (id) => `/api/v1/admin/decks/${id}`,
  },

  // Test/Seed (non-production only)
  test: {
    seedAll: '/api/v1/test/seed/all',
    seedUsers: '/api/v1/test/seed/users',
    seedDecks: '/api/v1/test/seed/decks',
    cleanup: '/api/v1/test/seed/cleanup',
  },
};
