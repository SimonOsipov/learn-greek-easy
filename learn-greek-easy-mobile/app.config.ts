import { ExpoConfig } from 'expo/config';

type Variant = 'development' | 'preview' | 'production';

const VARIANTS: Record<Variant, { name: string; bundleId: string; icon: string }> = {
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
  },
  owner: 'sams-team',
};

export default config;
