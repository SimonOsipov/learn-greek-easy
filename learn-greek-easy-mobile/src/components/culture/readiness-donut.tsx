/**
 * ReadinessDonut — 132×132 px SVG ring showing overall exam readiness %.
 *
 * Arc: primary → accent gradient, 9px strokeWidth, rounded caps.
 * Track: `line` token (bg of the full ring).
 * Centre label: pct number (Inter Tight 36/700) + "%" small (16/600, 60% opacity)
 *               + "READY" mono kicker (10/700, fg-2).
 *
 * Animation: strokeDashoffset fills from 0 → final value via Reanimated.
 * Gated by `reduceMotion` prop — when true, renders final value instantly.
 *
 * Note: SVG's linearGradient colour is fixed (matches primary hsl(221 83% 53%) →
 * accent hsl(221 83% 65%) light values). The arc gradient is presentational and
 * intentionally theme-invariant — it always matches the primary→accent brand gradient
 * used in the web design reference.
 */
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// Animated SVG Circle — Reanimated animates the strokeDashoffset
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 132;
const STROKE_WIDTH = 9;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// SVG is rotated -90deg so arc starts at 12 o'clock.

interface ReadinessDonutProps {
  /** Overall readiness ratio 0–1 (already divided from the backend 0–100 value). */
  pct: number;
  reduceMotion?: boolean;
}

export function ReadinessDonut({ pct, reduceMotion = false }: ReadinessDonutProps) {
  const offset = CIRCUMFERENCE * (1 - pct);
  const animatedOffset = useSharedValue(reduceMotion ? offset : CIRCUMFERENCE);

  useEffect(() => {
    if (reduceMotion) {
      animatedOffset.value = offset;
    } else {
      animatedOffset.value = withTiming(offset, {
        duration: 800,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [offset, reduceMotion, animatedOffset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: animatedOffset.value,
  }));

  const pctDisplay = Math.round(pct * 100);

  return (
    <View style={{ width: SIZE, height: SIZE, flexShrink: 0 }}>
      {/* SVG ring — rotated -90° so arc begins at top */}
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Defs>
          <LinearGradient id="donut-rg" x1="0" y1="0" x2="1" y2="1">
            {/* primary hsl(221 83% 53%) = rgb(36,99,235) */}
            <Stop offset="0%" stopColor="rgb(36,99,235)" />
            {/* accent hsl(221 83% 65%) = rgb(90,131,244) */}
            <Stop offset="100%" stopColor="rgb(90,131,244)" />
          </LinearGradient>
        </Defs>
        {/* Track circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="hsl(var(--line))"
          strokeWidth={STROKE_WIDTH}
        />
        {/* Arc circle */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="url(#donut-rg)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
        />
      </Svg>

      {/* Centre label — absolutely positioned over the SVG */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text
            className="text-fg"
            style={{
              fontFamily: 'InterTight_700Bold',
              fontSize: 36,
              fontWeight: '700',
              letterSpacing: -1,
              lineHeight: 36,
            }}
          >
            {pctDisplay}
          </Text>
          <Text
            className="text-fg"
            style={{
              fontFamily: 'InterTight_700Bold',
              fontSize: 16,
              fontWeight: '600',
              opacity: 0.6,
              lineHeight: 26,
              marginBottom: 2,
            }}
          >
            %
          </Text>
        </View>
        <Text
          className="text-fg2"
          style={{
            fontFamily: 'SpaceMono_400Regular',
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginTop: 3,
          }}
        >
          Ready
        </Text>
      </View>
    </View>
  );
}
