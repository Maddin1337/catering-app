import type { ConfigContext, ExpoConfig } from 'expo/config';

// Akzentfarbe wie tokens.color.accent (src/theme/tokens.ts); die Konfig lädt keinen App-Code.
const ACCENT = '#0F766E';

// Platzhalter, bis Name und Marke feststehen (offener Punkt E-2 in docs/06-roadmap.md).
// Die Bundle-ID lässt sich nach der ersten Store-Veröffentlichung nicht mehr ändern.
const BUNDLE_ID = 'com.example.cateringapp';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Catering App',
  slug: 'catering-app',
  version: '0.1.0',
  scheme: 'cateringapp',
  orientation: 'portrait',
  // Dark Mode ist im MVP nicht vorgesehen (docs/04-screens-ux.md §4.6).
  userInterfaceStyle: 'light',
  icon: './assets/images/icon.png',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: BUNDLE_ID,
    // Kein Tablet im MVP (R2-8).
    supportsTablet: false,
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    // SPA-Export: läuft auf statischem Hosting mit Fallback auf index.html (public/_redirects).
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    [
      'expo-splash-screen',
      {
        backgroundColor: ACCENT,
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  // Expo-Projekt „catering-app“ (Konto Maddin1337). Die ID ist nicht geheim.
  extra: {
    eas: { projectId: 'dc2b5867-d672-4490-8674-1515348853cc' },
  },
  // Over-the-air-Updates (EAS Update): neue JS-Stände ohne neuen Store-Build. Die Laufzeitversion
  // folgt der App-Version; ein Build nimmt nur Updates mit gleicher Laufzeitversion an.
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: 'https://u.expo.dev/dc2b5867-d672-4490-8674-1515348853cc' },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
