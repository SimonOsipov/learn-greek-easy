import { ExpoConfig } from 'expo/config';

type Variant = 'development' | 'preview' | 'production';

type VariantConfig = {
  name: string;
  bundleId: string;
  icon: string;
};

const VARIANTS: Record<Variant, VariantConfig> = {
  production: {
    name: 'Greeklish',
    bundleId: 'eu.greeklish.app',
    icon: './assets/images/icon.png',
  },
  preview: {
    name: 'Greeklish (Preview)',
    bundleId: 'eu.greeklish.app.preview',
    icon: './assets/images/icon.png',
  },
  development: {
    name: 'Greeklish (Dev)',
    bundleId: 'eu.greeklish.app.dev',
    icon: './assets/images/icon.png',
  },
};

const rawVariant = process.env.APP_VARIANT;
const variant: Variant =
  rawVariant && rawVariant in VARIANTS ? (rawVariant as Variant) : 'development';
const { name, bundleId, icon } = VARIANTS[variant];

// Supabase config and the backend API base URL come from EAS environment variables
// (server-side, scoped per environment) for cloud builds, or from a gitignored local .env
// for local development. src/lib/config.ts throws at app runtime if these are missing.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const apiUrl = process.env.API_URL;

// Observability env vars — optional. src/lib/config.ts returns undefined (no throw) when absent.
// POSTHOG_HOST is passed through raw; the helper in config.ts applies the US default when undefined.
const sentryDsn = process.env.SENTRY_DSN;
const posthogApiKey = process.env.POSTHOG_API_KEY;
const posthogHost = process.env.POSTHOG_HOST;
const environment = variant; // 'development' | 'preview' | 'production'

const config: ExpoConfig = {
  name,
  slug: 'greeklish-app',
  version: '1.0.0',
  // runtimeVersion policy = appVersion: runtimeVersion is derived from the app
  // `version` string, so a JS-only OTA is only delivered to binaries whose build
  // carried a matching runtimeVersion. eas update ships JS only — a native-module /
  // config change always requires a new build. The OTA-vs-native boundary therefore
  // holds as long as the release process bumps `version` before a native-affecting
  // build (note: eas.json sets appVersionSource: "remote", which manages build/version
  // codes remotely but does NOT change this `version` string — bumping it is a
  // release-process step). (fingerprint policy is still experimental — avoid.)
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: 'https://u.expo.dev/e1737431-1c87-45df-b1db-b171fa9da410',
  },
  orientation: 'portrait',
  icon,
  scheme: 'learngreekeasymobile',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: bundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    // CI-only: bake a default Metro URL into the dev-client binary so a cold
    // launch (incl. Maestro clearState reinstall) auto-connects to Metro and
    // loads the JS bundle instead of showing the dev-launcher menu. Unset
    // locally => no behavioral change for developers. See mobile-native-build.yml.
    ...(process.env.CI_DEV_LAUNCH_URL
      ? [['expo-dev-client', { defaultLaunchURL: process.env.CI_DEV_LAUNCH_URL }] as [string, Record<string, unknown>]]
      : []),
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      },
    ],
    ['expo-web-browser', { experimentalLauncherActivity: false }],
    [
      '@sentry/react-native/expo',
      {
        organization: 'greekly',
        project: 'greeklish-mobile',
        url: 'https://de.sentry.io/',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'e1737431-1c87-45df-b1db-b171fa9da410',
    },
    supabaseUrl,
    supabaseAnonKey,
    apiUrl,
    sentryDsn,
    posthogApiKey,
    posthogHost,
    environment,
  },
  owner: 'sams-team',
};

export default config;
