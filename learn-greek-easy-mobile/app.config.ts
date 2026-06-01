import { ExpoConfig } from 'expo/config';

type Variant = 'development' | 'preview' | 'production';

type VariantConfig = {
  name: string;
  bundleId: string;
  icon: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const DEV_SUPABASE_URL = 'https://nyiyljmtbnvykbpdjfjq.supabase.co';
const DEV_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aXlsam10Ym52eWticGRqZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzgwODIsImV4cCI6MjA4NjY1NDA4Mn0.gYDkCtg7cMAAhp_S1tJEeKWRpD1nfBpAG4EV-PhkDKg';

const VARIANTS: Record<Variant, VariantConfig> = {
  production: {
    name: 'Greeklish',
    bundleId: 'eu.greeklish.app',
    icon: './assets/images/icon.png',
    supabaseUrl: 'https://qduwfsuybkqsginndguz.supabase.co',
    supabaseAnonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdXdmc3V5Ymtxc2dpbm5kZ3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzM5MjEsImV4cCI6MjA4NjY0OTkyMX0.NpDnp3acY57GBg0oTHLHP60TXlviZQ5dOSgQJaS4otQ',
  },
  preview: {
    name: 'Greeklish (Preview)',
    bundleId: 'eu.greeklish.app.preview',
    icon: './assets/images/icon.png',
    supabaseUrl: DEV_SUPABASE_URL,
    supabaseAnonKey: DEV_SUPABASE_ANON_KEY,
  },
  development: {
    name: 'Greeklish (Dev)',
    bundleId: 'eu.greeklish.app.dev',
    icon: './assets/images/icon.png',
    supabaseUrl: DEV_SUPABASE_URL,
    supabaseAnonKey: DEV_SUPABASE_ANON_KEY,
  },
};

const rawVariant = process.env.APP_VARIANT;
const variant: Variant =
  rawVariant && rawVariant in VARIANTS ? (rawVariant as Variant) : 'development';
const { name, bundleId, icon, supabaseUrl, supabaseAnonKey } = VARIANTS[variant];

const config: ExpoConfig = {
  name,
  slug: 'greeklish-app',
  version: '1.0.0',
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
  },
  owner: 'sams-team',
};

export default config;
