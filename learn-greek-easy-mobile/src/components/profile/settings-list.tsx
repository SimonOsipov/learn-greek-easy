/**
 * SettingsList — profile screen settings rows.
 *
 * 5 rows in a card (bg-card, border-line, rounded-[16px]):
 *   1. Daily goal
 *   2. Notifications
 *   3. Audio & playback
 *   4. Theme        ← interactive (Light / Dark / System segmented control)
 *   5. About Greeklish
 *
 * Most rows are coming-soon stubs: pressing the row calls onRowPress(id) and the
 * parent connects that to showComingSoonToast() + analytics.
 *
 * The Theme row (THEME-04 / MOB-17) is the one live control: instead of a
 * chevron stub it hosts an inline 3-pill segmented control (FilterRail pattern)
 * that reflects `themePreference` and calls `onThemeChange(...)` directly. The
 * row itself is a plain View (no outer Pressable / no onRowPress) so the pills
 * are the only press targets — no nested-Pressable double-fire.
 */
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import type { ThemePreference } from '@/stores/theme-store';
import { useIconColor } from '@/hooks/use-icon-color';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SettingsRowId =
  | 'daily-goal'
  | 'notifications'
  | 'audio-playback'
  | 'theme'
  | 'about';

interface SettingsRow {
  id: SettingsRowId;
  label: string;
  sublabel: string;
}

/** The three theme options, in display order (D2 — Light / Dark / System). */
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export interface SettingsListProps {
  testID?: string;
  /** Sublabel for the "Daily goal" row (e.g. "20 cards"). */
  dailyGoalSublabel?: string;
  /** Sublabel for the "Theme" row (e.g. "System"). */
  themeSublabel?: string;
  /** Current theme preference — drives the Theme row's segmented control. */
  themePreference: ThemePreference;
  /** Called when the user picks a theme option in the Theme row. */
  onThemeChange: (preference: ThemePreference) => void;
  onRowPress: (id: SettingsRowId) => void;
}

// ---------------------------------------------------------------------------
// Static row definitions
// ---------------------------------------------------------------------------

const ROWS: SettingsRow[] = [
  { id: 'daily-goal',      label: 'Daily goal',       sublabel: '20 cards' },
  { id: 'notifications',   label: 'Notifications',    sublabel: 'Reminders, streak, news' },
  { id: 'audio-playback',  label: 'Audio & playback', sublabel: 'Voice, speed, autoplay' },
  { id: 'theme',           label: 'Theme',            sublabel: 'System' },
  { id: 'about',           label: 'About Greeklish',  sublabel: 'v1.0' },
];

// ---------------------------------------------------------------------------
// SettingsList
// ---------------------------------------------------------------------------

export function SettingsList({
  testID,
  dailyGoalSublabel,
  themeSublabel,
  themePreference,
  onThemeChange,
  onRowPress,
}: SettingsListProps) {
  // THEME-06: chevron color follows the live theme, resolved from the global store.
  const iconFg3 = useIconColor('fg-3');

  // Apply dynamic sublabels
  const rows = ROWS.map((row) => {
    if (row.id === 'daily-goal' && dailyGoalSublabel) {
      return { ...row, sublabel: dailyGoalSublabel };
    }
    if (row.id === 'theme' && themeSublabel) {
      return { ...row, sublabel: themeSublabel };
    }
    return row;
  });

  return (
    <View
      testID={testID ?? 'settings-list'}
      className="bg-card border border-line rounded-[16px] mx-[18px] overflow-hidden"
    >
      {rows.map((row, index) => {
        const isLast = index === rows.length - 1;
        const rowBorder = !isLast ? 'border-b border-line' : '';

        // ── Theme row (THEME-04) — live segmented control, not a coming-soon stub.
        // Rendered as a plain View (no outer Pressable) so each pill is the sole
        // press target: nesting Pressables would double-fire and confuse a11y.
        if (row.id === 'theme') {
          return (
            <View
              key={row.id}
              testID={`settings-row-${row.id}`}
              className={['gap-2.5 px-[14px] py-[14px]', rowBorder].join(' ')}
            >
              {/* Label + sublabel */}
              <View className="min-w-0">
                <Text
                  className="text-fg"
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    letterSpacing: -0.07,
                    lineHeight: 20,
                  }}
                  numberOfLines={1}
                >
                  {row.label}
                </Text>
                <Text
                  className="text-fg2"
                  style={{ fontSize: 12, lineHeight: 17 }}
                  numberOfLines={1}
                >
                  {row.sublabel}
                </Text>
              </View>

              {/* Segmented control — FilterRail pill pattern (App palette,
                  MOB-13-safe: text-on-photo is var-backed but used WITHOUT a
                  /NN modifier). Selected pill = filled primary; rest = outline. */}
              <View className="flex-row gap-1.5">
                {THEME_OPTIONS.map((opt) => {
                  const on = opt.value === themePreference;
                  return (
                    <Pressable
                      key={opt.value}
                      testID={`theme-pill-${opt.value}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Theme: ${opt.label}`}
                      onPress={() => onThemeChange(opt.value)}
                      className={
                        on
                          ? 'flex-1 h-8 px-3 rounded-full bg-primary border border-primary items-center justify-center'
                          : 'flex-1 h-8 px-3 rounded-full bg-card border border-line items-center justify-center active:opacity-70'
                      }
                    >
                      <Text
                        className={
                          on
                            ? 'text-on-photo text-[13px] font-semibold'
                            : 'text-fg text-[13px] font-semibold'
                        }
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        }

        // ── Coming-soon stub rows (daily-goal / notifications / audio / about).
        return (
          <Pressable
            key={row.id}
            testID={`settings-row-${row.id}`}
            onPress={() => onRowPress(row.id)}
            className={[
              'flex-row items-center gap-3 px-[14px] py-[14px] active:opacity-70',
              rowBorder,
            ].join(' ')}
          >
            {/* Labels */}
            <View className="flex-1 min-w-0">
              <Text
                className="text-fg"
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  letterSpacing: -0.07,
                  lineHeight: 20,
                }}
                numberOfLines={1}
              >
                {row.label}
              </Text>
              <Text
                className="text-fg2"
                style={{ fontSize: 12, lineHeight: 17 }}
                numberOfLines={1}
              >
                {row.sublabel}
              </Text>
            </View>

            {/* Chevron — explicit color prop per conventions.md §3.
                THEME-06: iconFg3 resolves per-theme from the store. */}
            <ChevronRight size={16} color={iconFg3} strokeWidth={2} />
          </Pressable>
        );
      })}
    </View>
  );
}
