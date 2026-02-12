import { Suspense, useEffect, type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthRoutesWrapper } from '@/components/auth/AuthRoutesWrapper';
import { LandingRoute } from '@/components/auth/LandingRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { ChunkErrorBoundary, ErrorBoundary } from '@/components/errors';
import { PageLoader } from '@/components/feedback';
import { AppLayout } from '@/components/layout';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { isAuth0Enabled } from '@/hooks/useAuth0Integration';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { Auth0ProviderWithNavigate, PostHogProvider } from '@/providers';
import { useAppStore, selectIsReady } from '@/stores/appStore';

// ============================================================================
// REACT QUERY CLIENT
// ============================================================================
// Single QueryClient instance for the entire application.
// Provides caching, deduplication, and background refetching for API calls.
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ============================================================================
// LAZY-LOADED PAGE COMPONENTS
// ============================================================================
// All page components are loaded dynamically to enable route-level code splitting.
// This reduces the initial bundle size and improves Time to Interactive (TTI).
//
// Named exports require the .then(m => ({ default: m.ExportName })) pattern.
// Default exports can use the simpler direct import syntax.
// ============================================================================

// Auth pages (wrapped with AuthRoutesWrapper for Google OAuth)
const Login = lazyWithRetry(() => import('@/pages/auth/Login').then((m) => ({ default: m.Login })));
const Register = lazyWithRetry(() =>
  import('@/pages/auth/Register').then((m) => ({ default: m.Register }))
);
const ForgotPassword = lazyWithRetry(() =>
  import('@/pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword }))
);
const Callback = lazyWithRetry(() =>
  import('@/pages/auth/Callback').then((m) => ({ default: m.Callback }))
);

// Main dashboard and navigation pages
const Dashboard = lazyWithRetry(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const DecksPage = lazyWithRetry(() =>
  import('@/pages/DecksPage').then((m) => ({ default: m.DecksPage }))
);
const DeckDetailPage = lazyWithRetry(() =>
  import('@/pages/DeckDetailPage').then((m) => ({ default: m.DeckDetailPage }))
);
const MyDecksPage = lazyWithRetry(() =>
  import('@/pages/MyDecksPage').then((m) => ({ default: m.MyDecksPage }))
);
const MyDeckDetailPage = lazyWithRetry(() =>
  import('@/pages/MyDeckDetailPage').then((m) => ({ default: m.MyDeckDetailPage }))
);

// User pages
const Profile = lazyWithRetry(() =>
  import('@/pages/Profile').then((m) => ({ default: m.Profile }))
);
const FeedbackPage = lazyWithRetry(() =>
  import('@/pages/FeedbackPage').then((m) => ({ default: m.FeedbackPage }))
);
const ChangelogPage = lazyWithRetry(() =>
  import('@/pages/ChangelogPage').then((m) => ({ default: m.ChangelogPage }))
);

// Review/practice pages (full-screen experience)
const FlashcardReviewPage = lazyWithRetry(() =>
  import('@/pages/FlashcardReviewPage').then((m) => ({ default: m.FlashcardReviewPage }))
);
const SessionSummaryPage = lazyWithRetry(() =>
  import('@/pages/SessionSummaryPage').then((m) => ({ default: m.SessionSummaryPage }))
);

// Culture deck pages
const CultureDeckDetailPage = lazyWithRetry(() =>
  import('@/pages/culture/CultureDeckDetailPage').then((m) => ({
    default: m.CultureDeckDetailPage,
  }))
);
const CulturePracticePage = lazyWithRetry(() =>
  import('@/pages/culture/CulturePracticePage').then((m) => ({ default: m.CulturePracticePage }))
);

// Mock exam pages
const MockExamPage = lazyWithRetry(() =>
  import('@/pages/MockExamPage').then((m) => ({ default: m.MockExamPage }))
);
const MockExamSessionPage = lazyWithRetry(() =>
  import('@/pages/MockExamSessionPage').then((m) => ({ default: m.MockExamSessionPage }))
);
const MockExamResultsPage = lazyWithRetry(() =>
  import('@/pages/MockExamResultsPage').then((m) => ({ default: m.MockExamResultsPage }))
);

// Statistics page (loads recharts chunk)
const Statistics = lazyWithRetry(() => import('@/pages/Statistics'));

// Achievements page
const AchievementsPage = lazyWithRetry(() => import('@/pages/AchievementsPage'));

// News page (paginated news articles)
const NewsPage = lazyWithRetry(() =>
  import('@/pages/NewsPage').then((m) => ({ default: m.NewsPage }))
);

// Admin page (requires admin role)
const AdminPage = lazyWithRetry(() => import('@/pages/AdminPage'));

// Dev/test pages
const ActivityFeedTest = lazyWithRetry(() => import('@/pages/ActivityFeedTest'));

// Error pages
const NotFound = lazyWithRetry(() =>
  import('@/pages/NotFound').then((m) => ({ default: m.NotFound }))
);
const Unauthorized = lazyWithRetry(() =>
  import('@/pages/Unauthorized').then((m) => ({ default: m.Unauthorized }))
);

// Landing page (public)
const LandingPage = lazyWithRetry(() => import('@/pages/LandingPage'));

// Word reference page (word entry detail)
const WordReferencePage = lazyWithRetry(() =>
  import('@/features/words/pages/WordReferencePage').then((m) => ({
    default: m.WordReferencePage,
  }))
);

// Word practice page (full-screen practice experience)
const WordPracticePage = lazyWithRetry(() =>
  import('@/features/words/pages/WordPracticePage').then((m) => ({
    default: m.WordPracticePage,
  }))
);

function AppContent() {
  const isAppReady = useAppStore(selectIsReady);
  const setReactHydrated = useAppStore((state) => state.setReactHydrated);

  useEffect(() => {
    setReactHydrated();
  }, [setReactHydrated]);

  return (
    <div data-app-ready={isAppReady}>
      <RouteGuard>
        <ChunkErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Landing Page - public, redirects authenticated users to dashboard */}
              <Route
                path="/"
                element={
                  <LandingRoute>
                    <LandingPage />
                  </LandingRoute>
                }
              />

              {/* Public Routes - redirect to dashboard if authenticated */}
              {/* Wrapped with AuthRoutesWrapper to provide Google OAuth only where needed */}
              <Route
                element={
                  <AuthRoutesWrapper>
                    <PublicRoute />
                  </AuthRoutesWrapper>
                }
              >
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>

              {/* OAuth callback route - handles Auth0 redirect with tokens in hash */}
              <Route path="/callback" element={<Callback />} />

              {/* Protected Routes - require authentication */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<AppLayout />}>
                  <Route index element={<Dashboard />} />
                </Route>
                <Route path="/decks" element={<AppLayout />}>
                  <Route index element={<DecksPage />} />
                  <Route path=":id" element={<DeckDetailPage />} />
                </Route>
                {/* Word reference page inside AppLayout */}
                <Route path="/decks/:deckId/words/:wordId" element={<AppLayout />}>
                  <Route index element={<WordReferencePage />} />
                </Route>
                {/* Word practice page outside AppLayout for full-screen experience */}
                <Route
                  path="/decks/:deckId/words/:wordId/practice"
                  element={<WordPracticePage />}
                />
                <Route path="/my-decks" element={<AppLayout />}>
                  <Route index element={<MyDecksPage />} />
                  <Route path=":id" element={<MyDeckDetailPage />} />
                </Route>
                <Route path="/statistics" element={<AppLayout />}>
                  <Route index element={<Statistics />} />
                </Route>
                <Route path="/stats" element={<Navigate to="/statistics" replace />} />
                <Route path="/profile" element={<AppLayout />}>
                  <Route index element={<Profile />} />
                </Route>
                <Route path="/achievements" element={<AppLayout />}>
                  <Route index element={<AchievementsPage />} />
                </Route>
                <Route path="/feedback" element={<AppLayout />}>
                  <Route index element={<FeedbackPage />} />
                </Route>
                <Route path="/changelog" element={<AppLayout />}>
                  <Route index element={<ChangelogPage />} />
                </Route>
                <Route path="/activity-feed-test" element={<AppLayout />}>
                  <Route index element={<ActivityFeedTest />} />
                </Route>
                {/* Review page outside AppLayout for full-screen experience */}
                <Route path="/decks/:deckId/review" element={<FlashcardReviewPage />} />
                {/* Session summary page outside AppLayout for full-screen experience */}
                <Route path="/decks/:deckId/summary" element={<SessionSummaryPage />} />
                {/* Culture deck detail page inside AppLayout */}
                <Route path="/culture/decks/:id" element={<AppLayout />}>
                  <Route index element={<CultureDeckDetailPage />} />
                </Route>
                {/* Culture practice pages outside AppLayout for full-screen immersive experience */}
                <Route path="/culture/:deckId/practice" element={<CulturePracticePage />} />
                <Route
                  path="/culture/:deckId/summary"
                  element={<Navigate to="../practice" replace />}
                />
                {/* Redirect /practice/ to /practice/culture-exam */}
                <Route
                  path="/practice"
                  element={<Navigate to="/practice/culture-exam" replace />}
                />
                {/* Mock exam landing page inside AppLayout */}
                <Route path="/practice/culture-exam" element={<AppLayout />}>
                  <Route index element={<MockExamPage />} />
                </Route>
                {/* Mock exam session page outside AppLayout for full-screen experience */}
                <Route path="/practice/culture-exam/session" element={<MockExamSessionPage />} />
                {/* Mock exam results page outside AppLayout for full-screen experience */}
                <Route path="/practice/culture-exam/results" element={<MockExamResultsPage />} />
                {/* News feed page */}
                <Route path="/news" element={<AppLayout />}>
                  <Route index element={<NewsPage />} />
                </Route>
              </Route>

              {/* Admin Routes - require admin role */}
              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route path="/admin" element={<AppLayout />}>
                  <Route index element={<AdminPage />} />
                </Route>
              </Route>

              {/* Error Pages */}
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ChunkErrorBoundary>
      </RouteGuard>

      <Toaster />
    </div>
  );
}

/**
 * Conditional Auth0 Provider wrapper.
 * Wraps children with Auth0Provider when Auth0 is enabled.
 * Must be inside BrowserRouter for useNavigate to work.
 */
function ConditionalAuth0Provider({ children }: { children: ReactNode }) {
  if (!isAuth0Enabled()) {
    return <>{children}</>;
  }

  return <Auth0ProviderWithNavigate>{children}</Auth0ProviderWithNavigate>;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* Auth0Provider must be inside BrowserRouter for useNavigate */}
          <ConditionalAuth0Provider>
            <PostHogProvider>
              <TooltipProvider>
                <ThemeProvider>
                  <LanguageProvider>
                    <LayoutProvider>
                      <NotificationProvider>
                        <AppContent />
                      </NotificationProvider>
                    </LayoutProvider>
                  </LanguageProvider>
                </ThemeProvider>
              </TooltipProvider>
            </PostHogProvider>
          </ConditionalAuth0Provider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
