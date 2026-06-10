/**
 * ProgressHeader — top bar + progress section for the card-review screen.
 *
 * Shows:
 *   - Left: X exit button
 *   - Center: "Card N of total" (mono) + thin accent progress bar
 *   - Right: EN/RU language segment + theme toggle (sun/moon)
 *
 * Uses explicit isDark-keyed rgb constants (MOB-13 + #5/#25 dark-mode fix).
 * practice-* classNames are NOT used here — they always resolve to light values
 * on native since darkMode:'class' is unconnected (nothing calls colorScheme.set).
 */
import { View, Text, Pressable } from 'react-native';
import { X, Sun, Moon } from 'lucide-react-native';

import { reviewPalette } from '@/lib/review/presentation';

// MOB-13: explicit rgba — no /NN modifier on var-backed tokens
const ICON_COLOR = 'rgb(100,116,139)';         // --practice-text-muted (light)
const ICON_COLOR_DARK = 'rgb(148,163,184)';    // --practice-text-muted (dark)

export interface ProgressHeaderProps {
  currentIndex: number;
  total: number;
  locale: 'en' | 'ru';
  onLocaleChange: (locale: 'en' | 'ru') => void;
  isDark: boolean;
  onThemeToggle: () => void;
  onClose: () => void;
  testID?: string;
}

export function ProgressHeader({
  currentIndex,
  total,
  locale,
  onLocaleChange,
  isDark,
  onThemeToggle,
  onClose,
  testID,
}: ProgressHeaderProps) {
  const progress = total > 0 ? (currentIndex / total) : 0;
  const iconColor = isDark ? ICON_COLOR_DARK : ICON_COLOR;
  // #5/#25/#29: derive all practice-* colors from isDark prop (explicit rgb constants).
  // NativeWind darkMode:'class' is unconnected on native, so practice-* classNames always
  // resolve to light values — they cannot be used here.
  const palette = reviewPalette(isDark);

  return (
    <View testID={testID ?? 'review-progress-header'} className="px-4 pt-2 pb-3">
      {/* ── Top bar ── */}
      <View className="flex-row items-center justify-between mb-4">
        {/* Exit button */}
        <Pressable
          testID="review-close-btn"
          accessibilityRole="button"
          accessibilityLabel="Close review"
          onPress={onClose}
          className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
          style={{ backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.10)' }}
        >
          <X size={18} color={iconColor} strokeWidth={2.2} />
        </Pressable>

        {/* EN/RU language segment — explicit border + bg (practice-* classNames broken on native) */}
        <View
          className="flex-row rounded-full overflow-hidden"
          style={{ gap: 0, borderWidth: 1, borderColor: palette.borderColor }}
        >
          <Pressable
            testID="review-locale-en"
            accessibilityRole="button"
            onPress={() => onLocaleChange('en')}
            className="px-3.5 py-1.5 active:opacity-70"
            style={{
              // #6/#26: explicit rgb — hsl(var(--practice-accent)) is unparseable in RN style props
              backgroundColor: locale === 'en' ? palette.localePillBg : 'transparent',
            }}
          >
            <Text
              className="text-[12px] font-bold"
              style={{
                fontFamily: 'SpaceMono_400Regular',
                color: locale === 'en' ? '#fff' : palette.iconColor,
              }}
            >
              EN
            </Text>
          </Pressable>
          <Pressable
            testID="review-locale-ru"
            accessibilityRole="button"
            onPress={() => onLocaleChange('ru')}
            className="px-3.5 py-1.5 active:opacity-70"
            style={{
              // #6/#26: explicit rgb — hsl(var(--practice-accent)) is unparseable in RN style props
              backgroundColor: locale === 'ru' ? palette.localePillBg : 'transparent',
            }}
          >
            <Text
              className="text-[12px] font-bold"
              style={{
                fontFamily: 'SpaceMono_400Regular',
                color: locale === 'ru' ? '#fff' : palette.iconColor,
              }}
            >
              RU
            </Text>
          </Pressable>
        </View>

        {/* Theme toggle */}
        <Pressable
          testID="review-theme-toggle"
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={onThemeToggle}
          className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
          style={{ backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.10)' }}
        >
          {isDark ? (
            <Sun size={18} color={iconColor} strokeWidth={2} />
          ) : (
            <Moon size={18} color={iconColor} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      {/* ── Progress section ── */}
      <View className="items-center mb-3">
        <Text
          testID="review-card-counter"
          className="text-[13px] mb-2"
          style={{ fontFamily: 'SpaceMono_400Regular', color: palette.textMuted }}
        >
          Card {Math.min(currentIndex + 1, total)} of {total}
        </Text>
      </View>

      {/* ── Progress bar — explicit colors; practice-* classNames unconnected on native ── */}
      <View
        testID="review-progress-bar-track"
        className="h-0.5 rounded-full overflow-hidden"
        style={{ backgroundColor: palette.borderColor }}
      >
        <View
          testID="review-progress-bar-fill"
          className="h-full rounded-full"
          style={{ width: `${progress * 100}%`, backgroundColor: palette.accent }}
        />
      </View>
    </View>
  );
}
