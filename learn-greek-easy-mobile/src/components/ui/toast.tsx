/**
 * Minimal ephemeral toast for the mobile app.
 *
 * Usage:
 *   1. Mount `<ToastProvider>` ONCE at the app shell (root _layout.tsx).
 *   2. Call `useToast().showComingSoonToast()` from any screen/component.
 *      The toast auto-dismisses after 2 s.
 *
 * Design decisions:
 *   - Single transient message; no queue/stacking (not needed for this story).
 *   - Mounted once — no portal magic required in RN (an overlay View at the
 *     top of the tree naturally renders above all sibling content).
 *   - Tokens only: bg-card / border-line / text-fg — no raw hex.
 *   - Dark-default: tokens resolve correctly in both light and dark colour schemes.
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Text, View } from 'react-native';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ToastContextValue {
  showComingSoonToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const DISMISS_DELAY_MS = 2000;

/** Mount once at the app shell. Exposes `showComingSoonToast()` app-wide. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [opacity] = useState(() => new Animated.Value(0));
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showComingSoonToast = useCallback(() => {
    // Cancel any in-flight dismiss timer so back-to-back calls restart the clock.
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    setVisible(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    dismissTimer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }, DISMISS_DELAY_MS);
  }, [opacity]);

  return (
    <ToastContext.Provider value={{ showComingSoonToast }}>
      {children}
      {visible && (
        <Animated.View
          testID="toast-overlay"
          style={{ opacity }}
          pointerEvents="none"
          className="absolute bottom-16 left-0 right-0 items-center px-4"
        >
          <View className="bg-card border border-line rounded-xl px-4 py-3 shadow-sm">
            <Text
              testID="toast-message"
              className="text-fg text-sm text-center"
              style={{ fontFamily: 'SplineSans_500Medium' }}
            >
              Coming soon — stay tuned!
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the toast context. Must be called inside a `<ToastProvider>` subtree.
 *
 * @example
 *   const { showComingSoonToast } = useToast();
 *   <Pressable onPress={() => { showComingSoonToast(); }}>...</Pressable>
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
