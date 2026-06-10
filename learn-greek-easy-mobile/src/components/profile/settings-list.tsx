/**
 * SettingsList — profile screen settings rows.
 *
 * 5 rows in a card (bg-card, border-line, rounded-[16px]):
 *   1. Daily goal
 *   2. Notifications
 *   3. Audio & playback
 *   4. Theme
 *   5. About Greeklish
 *
 * Each row has a label, sublabel, and a right-chevron icon.
 * All rows are coming-soon stubs: pressing calls onRowPress(id).
 * The parent screen connects this to showComingSoonToast() + analytics.
 */
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// fg-3 hsl(222 14% 56%) = rgb(127,136,159) — canonical ICON_FG3 (conventions.md §3)
const ICON_FG3 = 'rgb(127,136,159)';

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

export interface SettingsListProps {
  testID?: string;
  /** Sublabel for the "Daily goal" row (e.g. "20 cards"). */
  dailyGoalSublabel?: string;
  /** Sublabel for the "Theme" row (e.g. "System"). */
  themeSublabel?: string;
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
  onRowPress,
}: SettingsListProps) {
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
        return (
          <Pressable
            key={row.id}
            testID={`settings-row-${row.id}`}
            onPress={() => onRowPress(row.id)}
            className={[
              'flex-row items-center gap-3 px-[14px] py-[14px] active:opacity-70',
              !isLast ? 'border-b border-line' : '',
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

            {/* Chevron — explicit color prop per conventions.md §3 */}
            <ChevronRight size={16} color={ICON_FG3} strokeWidth={2} />
          </Pressable>
        );
      })}
    </View>
  );
}
