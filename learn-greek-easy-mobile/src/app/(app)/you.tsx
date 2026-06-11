/**
 * YouScreen — the You / Profile tab (MOB-11).
 *
 * Blocks (top to bottom):
 *   1. Header — "YOUR PROFILE" mono kicker + settings gear icon (coming soon).
 *   2. Identity block — ProfileHeader (avatar, name, level pill, progress bar).
 *   3. Week heatmap card — WeekHeatmapCard (7-cell activity grid + summary).
 *   4. Stat tiles — ProfileStatGrid (Day Streak / Mastered / Total Time / Best Streak).
 *   5. Settings list — SettingsList (5 rows, all coming-soon stubs).
 *   6. Sign out — SignOutButton (destructive outline, native Alert confirmation).
 *
 * Data:
 *   - useUserProfile()       → name, initials, avatar_url, settings.daily_goal
 *   - useXpStats()           → level name, progress_percentage
 *   - useProgressDashboard() → streak (current/best), mastered cards, all-time seconds
 *   - useWeekTrends()        → weekly heatmap buckets + summary (sessions, study time)
 *
 * Pull-to-refresh refetches all four queries. Loading state shows skeleton.
 * Analytics: profile_screen_viewed (once, after data resolves).
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings } from 'lucide-react-native';

// fg hsl(222 32% 12%) = rgb(22,30,52) — used for Settings icon (primary content color)
// Using text-fg token value: rgb(22,30,52) as documented in global.css
const ICON_FG = 'rgb(22,30,52)'; // --fg hsl(222 32% 12%)

import { useUserProfile } from '@/hooks/use-user-profile';
import { useXpStats } from '@/hooks/use-xp-stats';
import { useProgressDashboard } from '@/hooks/use-progress-dashboard';
import { useWeekTrends } from '@/hooks/use-week-trends';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics';
import { buildHeatmap } from '@/lib/dashboard/derive';

import { ProfileHeader } from '@/components/profile/profile-header';
import { WeekHeatmapCard } from '@/components/profile/week-heatmap-card';
import { ProfileStatGrid } from '@/components/profile/profile-stat-grid';
import { SettingsList } from '@/components/profile/settings-list';
import type { SettingsRowId } from '@/components/profile/settings-list';
import { SignOutButton } from '@/components/profile/sign-out-button';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extracts up to two uppercase initials from a full name. */
function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Convert JS getDay() (0=Sun) to Mon=0 index.
 * Monday=0, Tuesday=1, …, Sunday=6.
 */
function todayHeatmapIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

// ---------------------------------------------------------------------------
// YouScreen
// ---------------------------------------------------------------------------

export default function YouScreen() {
  const { showComingSoonToast } = useToast();
  const signOut = useAuthStore((state) => state.signOut);

  const profileQuery = useUserProfile();
  const xpQuery = useXpStats();
  const dashboardQuery = useProgressDashboard();
  const trendsQuery = useWeekTrends();

  // ── Pull-to-refresh ──
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshing = useRef(false);
  const handleRefresh = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        profileQuery.refetch(),
        xpQuery.refetch(),
        dashboardQuery.refetch(),
        trendsQuery.refetch(),
      ]);
    } finally {
      isRefreshing.current = false;
      setRefreshing(false);
    }
  }, [profileQuery, xpQuery, dashboardQuery, trendsQuery]);

  // ── Analytics: profile_screen_viewed (once, after primary data resolves) ──
  const viewedFired = useRef(false);
  useEffect(() => {
    if (profileQuery.data && dashboardQuery.data && !viewedFired.current) {
      viewedFired.current = true;
      track('profile_screen_viewed', {
        current_streak: dashboardQuery.data.streak.current_streak,
        mastered_cards: dashboardQuery.data.overview.total_cards_mastered,
      });
    }
  }, [profileQuery.data, dashboardQuery.data]);

  // ── Settings row handler ──
  const handleSettingsRow = useCallback(
    (id: SettingsRowId) => {
      track('profile_row_tapped', { row: id, coming_soon: true });
      showComingSoonToast();
    },
    [showComingSoonToast],
  );

  // ── Gear icon handler ──
  const handleGearPress = useCallback(() => {
    track('profile_row_tapped', { row: 'gear', coming_soon: true });
    showComingSoonToast();
  }, [showComingSoonToast]);

  // ── Sign out handler ──
  const handleSignOut = useCallback(() => {
    track('profile_signed_out');
    void signOut();
  }, [signOut]);

  // ── Loading + error states ──
  // XP query is non-critical — its data falls back to "Learner" defaults so it
  // does not block the screen render. Profile + dashboard are the critical pair.
  const isLoading =
    profileQuery.isLoading ||
    dashboardQuery.isLoading ||
    trendsQuery.isLoading;

  const isError =
    (profileQuery.isError || dashboardQuery.isError) && !isLoading;

  if (isError) {
    return (
      <SafeAreaView
        testID="you-error"
        className="flex-1 bg-bg items-center justify-center px-8"
      >
        <Text className="text-fg2 text-[15px] text-center mb-5">
          Couldn&apos;t load your profile.
        </Text>
        <Pressable
          testID="you-error-retry"
          onPress={() => {
            void profileQuery.refetch();
            void dashboardQuery.refetch();
            void trendsQuery.refetch();
            void xpQuery.refetch();
          }}
          className="px-6 py-3 rounded-xl bg-card border border-line active:opacity-70"
        >
          <Text className="text-primary text-[14px] font-semibold">Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView testID="you-loading" className="flex-1 bg-bg">
        <View className="px-[18px] pt-14 gap-3">
          <View className="w-32 h-3 rounded-full bg-bg-2" />
          {/* Identity block skeleton */}
          <View className="flex-row items-center gap-[14px]">
            <View className="w-[68px] h-[68px] rounded-full bg-bg-2" />
            <View className="flex-1 gap-2">
              <View className="w-40 h-6 rounded-md bg-bg-2" />
              <View className="w-28 h-4 rounded-full bg-bg-2" />
              <View className="w-full h-[5px] rounded-full bg-bg-2" />
            </View>
          </View>
          {/* Heatmap card skeleton */}
          <View className="rounded-[16px] bg-bg-2" style={{ height: 100 }} />
          {/* Stat grid skeleton — 2 rows */}
          <View className="flex-row gap-[10px]">
            <View className="flex-1 rounded-[14px] bg-bg-2" style={{ height: 80 }} />
            <View className="flex-1 rounded-[14px] bg-bg-2" style={{ height: 80 }} />
          </View>
          <View className="flex-row gap-[10px]">
            <View className="flex-1 rounded-[14px] bg-bg-2" style={{ height: 80 }} />
            <View className="flex-1 rounded-[14px] bg-bg-2" style={{ height: 80 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived data ──
  const profile = profileQuery.data!;
  const dashboard = dashboardQuery.data!;
  const trends = trendsQuery.data;
  const xp = xpQuery.data;

  const fullName = profile.full_name ?? profile.email ?? 'User';
  const initials = getInitials(fullName);

  const levelName = xp?.level_name_english ?? 'Learner';
  const progressPct = xp?.progress_percentage ?? 0;
  const currentLevel = xp?.current_level;

  const heat = buildHeatmap(trends?.daily_stats ?? []);
  const todayIndex = todayHeatmapIndex();
  const totalSessions = trends?.summary?.total_reviews ?? 0;
  const totalStudySeconds = trends?.summary?.total_study_time_seconds ?? 0;

  const currentStreak = dashboard.streak.current_streak;
  const bestStreak = dashboard.streak.longest_streak;
  const masteredCards = dashboard.overview.total_cards_mastered;
  const allTimeSeconds = dashboard.overview.total_study_time_seconds;

  const dailyGoal = profile.settings?.daily_goal ?? 20;
  const dailyGoalSublabel = `${dailyGoal} cards`;
  const themeSublabel = profile.settings?.theme ?? 'System';

  return (
    <SafeAreaView testID="you-screen" className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        testID="you-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* ── Block 1: Header ── */}
        <View className="px-[18px] pt-14 pb-0 flex-row items-center justify-between">
          <Text
            testID="you-kicker"
            className="text-fg3"
            style={{
              fontFamily: 'SpaceMono_400Regular',
              fontSize: 10.5,
              fontWeight: '700',
              letterSpacing: 1.26,
              textTransform: 'uppercase',
            }}
          >
            Your profile
          </Text>
          <Pressable
            testID="you-gear-button"
            onPress={handleGearPress}
            className="w-8 h-8 items-center justify-center rounded-full active:opacity-70"
          >
            {/* Explicit color prop per conventions.md §3 — no wrapper-View for icon color */}
            <Settings size={20} color={ICON_FG} strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Block 2: Identity block ── */}
        <View className="mt-5">
          <ProfileHeader
            testID="you-profile-header"
            fullName={fullName}
            initials={initials}
            avatarUrl={profile.avatar_url}
            levelName={levelName}
            progressPct={progressPct}
            currentLevel={currentLevel}
          />
        </View>

        {/* ── Block 3: Week heatmap card ── */}
        <View className="mt-6">
          <WeekHeatmapCard
            testID="you-heatmap-card"
            heat={heat}
            todayIndex={todayIndex}
            totalSessions={totalSessions}
            totalStudySeconds={totalStudySeconds}
          />
        </View>

        {/* ── Block 4: Stat tiles ── */}
        <View className="mt-[14px]">
          <ProfileStatGrid
            currentStreak={currentStreak}
            masteredCards={masteredCards}
            allTimeSeconds={allTimeSeconds}
            bestStreak={bestStreak}
          />
        </View>

        {/* ── Block 5: Settings list ── */}
        <View className="mt-6">
          <SettingsList
            testID="you-settings-list"
            dailyGoalSublabel={dailyGoalSublabel}
            themeSublabel={themeSublabel}
            onRowPress={handleSettingsRow}
          />
        </View>

        {/* ── Block 6: Sign out ── */}
        <View className="mt-5 mb-2">
          <SignOutButton
            testID="you-sign-out-button"
            onSignOut={handleSignOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
