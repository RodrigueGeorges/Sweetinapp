import type { ExpoConfig } from 'expo/config';

// Identifiants à adapter avant la première publication (voir README).
const BUNDLE_ID = process.env.APP_BUNDLE_ID ?? 'app.sweetin.ios';
const PACKAGE = process.env.APP_PACKAGE ?? 'app.sweetin.android';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '3f4fab34-ff2f-47eb-ab12-7341ee2925b5';
// Domaine des liens d'invitation (https://sweetin.app/u/<pseudo>), voir web/.well-known
const LINK_DOMAIN = process.env.APP_LINK_DOMAIN ?? 'sweetin.app';
const APP_GROUP = `group.${BUNDLE_ID}`;

const config: ExpoConfig = {
  name: 'Sweetin',
  slug: 'sweetin',
  owner: 'rodrigueetifiers-team',
  scheme: 'sweetin',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#FF2D5F',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    // identifiant d'équipe Apple (developer.apple.com > Membership), requis pour signer le widget
    appleTeamId: process.env.APPLE_TEAM_ID,
    buildNumber: '1',
    // iOS 18+ : icône sombre et teintée (sinon iOS en fabrique une lui-même)
    icon: { light: './assets/icon.png', dark: './assets/icon-dark.png', tinted: './assets/icon-tinted.png' },
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    usesAppleSignIn: true,
    associatedDomains: [`applinks:${LINK_DOMAIN}`],
    entitlements: {
      'com.apple.security.application-groups': [APP_GROUP],
      // tranche d'âge déclarée à Apple, exigée par certaines lois (Texas…) ; voir lib/age.ts
      'com.apple.developer.declared-age-range': true,
    },
    infoPlist: { UIBackgroundModes: ['remote-notification'], CFBundleAllowMixedLocalizations: true },
  },
  android: {
    package: PACKAGE,
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#FF2D5F',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // pas de micro, pas d'écriture des contacts, pas de « superposition aux autres apps » (ajoutée par défaut)
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.WRITE_CONTACTS', 'android.permission.SYSTEM_ALERT_WINDOW'],
    // la session et le brouillon ne partent pas dans la sauvegarde Google Drive du téléphone
    allowBackup: false,
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: LINK_DOMAIN, pathPrefix: '/u/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-image',
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 150, resizeMode: 'contain', backgroundColor: '#FF2D5F' },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Sweetin utilise la caméra pour prendre la photo de ton flip.',
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Sweetin accède à tes photos quand tu choisis une image pour ton flip.',
        cameraPermission: 'Sweetin utilise la caméra pour prendre la photo de ton flip.',
        microphonePermission: false,
      },
    ],
    [
      'expo-notifications',
      {
        // petite icône Android de la barre d'état : silhouette blanche du cornet (sinon un carré blanc)
        icon: './assets/notification-icon.png',
        color: '#FF2D5F',
        sounds: ['./assets/sounds/sweet.wav', './assets/sounds/sweethour.wav', './assets/sounds/streak.wav'],
      },
    ],
    [
      'expo-contacts',
      { contactsPermission: 'Sweetin compare des empreintes chiffrées des numéros de tes contacts pour te montrer ceux qui sont déjà sur Sweetin. Rien n’est conservé.' },
    ],
    'expo-apple-authentication',
    'expo-asset',
    'expo-web-browser',
    'expo-secure-store',
    ['expo-localization', { supportedLocales: { ios: ['fr', 'en'], android: ['fr', 'en'] } }],
    // Live Activity du Sweet Hour (écran verrouillé, Dynamic Island), démarrable à distance : src/widgets
    ['expo-widgets', { enablePushNotifications: true, groupIdentifier: APP_GROUP, bundleIdentifier: `${BUNDLE_ID}.live`, widgets: [] }],
    '@bacons/apple-targets',
    [
      'react-native-android-widget',
      {
        fonts: ['./assets/fonts/SweetinDisplay.ttf', './assets/fonts/SweetinText-ExtraBold.ttf'],
        widgets: [
          {
            name: 'Sweetin',
            label: 'Sweetin',
            description: 'Tes flips à gratter, et un raccourci pour en envoyer un.',
            minWidth: '160dp',
            minHeight: '160dp',
            targetCellWidth: 2,
            targetCellHeight: 2,
            resizeMode: 'horizontal|vertical',
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
    // envoi des symboles de débogage à Sentry, seulement si le projet est configuré
    ...(process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
      ? ([['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]] as ExpoConfig['plugins'] & object)
      : []),
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: EAS_PROJECT_ID },
    privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://sweetin.app/confidentialite',
    termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://sweetin.app/conditions',
    privacyUrlEn: process.env.EXPO_PUBLIC_PRIVACY_URL_EN ?? 'https://sweetin.app/en/privacy',
    termsUrlEn: process.env.EXPO_PUBLIC_TERMS_URL_EN ?? 'https://sweetin.app/en/terms',
    safetyUrl: 'https://sweetin.app/securite-enfants',
    safetyUrlEn: 'https://sweetin.app/en/child-safety',
    supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'team@sweetin.app',
  },
  updates: EAS_PROJECT_ID ? { url: `https://u.expo.dev/${EAS_PROJECT_ID}` } : undefined,
  runtimeVersion: { policy: 'appVersion' },
};

export default config;
