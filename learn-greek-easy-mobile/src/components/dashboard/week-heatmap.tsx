/**
 * WeekHeatmap — 7-cell activity intensity grid for the dashboard progress band.
 *
 * Renders a mono "THIS WEEK" label + 7 cells (M T W T F S S) distributed
 * `justify-between` across the full row width.  Each cell's fill intensity
 * maps from a bucket value 0–5 to an increasing element-level opacity on a
 * solid `bg-primary` cell.
 *
 * MOB-13 INTENSITY RAMP:
 *   The design mock uses `hsl(var(--primary) / alpha)` which triggers the
 *   NativeWind v4 native `color-mix()` bug (MOB-13).  The safe workaround
 *   selected here is **element-level `style={{ opacity }}`** on a solid
 *   `bg-primary` View.  Element opacity is applied by the RN renderer as
 *   `style.opacity`, not via color-mix(), so it renders correctly on native
 *   at all brightness levels.  See docs/design-tokens.md §NWOPA-02.
 *
 * Bucket → opacity mapping (mirrors the mock's 6-stop ramp):
 *   0 → 0.06  (dim neutral — "no activity" state)
 *   1 → 0.22
 *   2 → 0.38
 *   3 → 0.55
 *   4 → 0.78
 *   5 → 1.00  (full primary)
 *
 * Today's cell gets a `border-2 border-fg` outline and its weekday letter
 * is rendered in `text-fg` instead of `text-fg3`.
 */
import { View, Text } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeekHeatmapProps {
  /**
   * 7-element array of activity buckets (0–5), indexed Mon → Sun.
   * Must be exactly 7 elements; caller is responsible for padding (buildHeatmap
   * in lib/dashboard/derive.ts always returns 7 elements).
   */
  heat: number[];
  /**
   * Index (0–6) of today's cell.  When undefined, no cell is outlined.
   * The default for production use is: `new Date().getDay()` adjusted so that
   * 0=Monday (Sunday = index 6).  The parent screen supplies this to keep the
   * component purely presentational and trivially testable.
   */
  todayIndex?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Bucket → element opacity mapping (0–5 → 0.06–1.00). */
const BUCKET_OPACITY: readonly number[] = [0.06, 0.22, 0.38, 0.55, 0.78, 1.00];

// ---------------------------------------------------------------------------
// WeekHeatmap
// ---------------------------------------------------------------------------

export function WeekHeatmap({ heat, todayIndex }: WeekHeatmapProps) {
  // Guard: if fewer than 7 items are passed, pad with zeros to avoid crashes.
  const cells = heat.length >= 7 ? heat.slice(0, 7) : [...heat, ...Array(7 - heat.length).fill(0)];

  return (
    <View
      testID="week-heatmap"
      className="flex-row items-center justify-between w-full gap-1.5"
    >
      {/* "THIS WEEK" mono label */}
      <Text
        testID="heatmap-label"
        className="text-fg3 text-[9.5px] uppercase tracking-[0.10em] mr-0.5"
        style={{ fontFamily: 'SpaceMono_400Regular' }}
      >
        This week
      </Text>

      {/* 7 cells */}
      {cells.map((bucket, i) => {
        const isToday = i === todayIndex;
        const opacity = BUCKET_OPACITY[Math.min(Math.max(bucket, 0), 5)];

        return (
          <View
            key={i}
            testID={`heatmap-cell-${i}`}
            className="items-center gap-[3px]"
          >
            {/* Cell square — solid bg-primary, element opacity drives intensity */}
            <View
              testID={isToday ? 'heatmap-today-cell' : undefined}
              className={[
                'w-3.5 h-3.5 rounded-[4px] bg-primary',
                isToday ? 'border-2 border-fg' : '',
              ].join(' ')}
              style={{ opacity }}
            />
            {/* Weekday letter */}
            <Text
              className={[
                'text-[8.5px] font-semibold',
                isToday ? 'text-fg' : 'text-fg3',
              ].join(' ')}
              style={{ fontFamily: 'SpaceMono_400Regular' }}
            >
              {WEEKDAY_LABELS[i]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
