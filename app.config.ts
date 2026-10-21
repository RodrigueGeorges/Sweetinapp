import type { ExpoConfig } from 'expo/config';

// Identifiants à adapter avant la première publication (voir README).
const BUNDLE_ID = process.env.APP_BUNDLE_ID ?? 'app.sweetin.ios';
const PACKAGE = process.env.APP_PACKAGE ?? 'app.sweetin.android';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || '3f4fab34-ff2f-47eb-ab12-7341ee2925b5';
// Domaine des liens d'invitation (https://sweetin.app/u/<pseudo>), voir web/.well-known
const LINK_DOMAIN = process.env.APP_LINK_DOMAIN ?? 'sweetin.app';
const APP_GROUP = `group.${BUNDLE_ID}`;

// Garde-fou des builds de production : sans ces variables, l'app planterait au lancement (et serait refusée).
// EAS définit EAS_BUILD_PROFILE pendant un build ; les valeurs viennent de l'environnement « production » d'EAS.
if (process.env.EAS_BUILD_PROFILE === 'production') {
  const missing = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EAS_PROJECT_ID', ...(process.env.EAS_BUILD_PLATFORM === 'ios' ? ['APPLE_TEAM_ID'] : [])].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Build de production arrêté : variables manquantes dans l'environnement EAS « production » : ${missing.join(', ')} (voir MISE-EN-LIGNE.md).`);
}

const config: ExpoConfig = {
  name: 'Sweetin',
  slug: 'sweetin',
  owner: 'rodrigueetifiers-team',
  scheme: 'sweetin',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#FFFFFF', // fond derrière les écrans (le lancement, lui, reste framboise)
  ios: {
    bundleIdentifier: BUNDLE_ID,
    // identifiant d'équipe Apple (developer.apple.com > Membership), requis pour signer le widget
    appleTeamId: process.env.APPLE_TEAM_ID,
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
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      CFBundleAllowMixedLocalizations: true,
      // react-native-vision-camera n'a pas de plugin Expo : la raison d'usage est déclarée ici (+ locales/)
      NSCameraUsageDescription: 'Sweetin uses the camera to take the photo for your sweet and to scan a friend’s QR code.',
    },
    // manifeste de confidentialité : les API « à justifier » utilisées par l'app et ses dépendances
    // (relevées dans les PrivacyInfo.xcprivacy de node_modules, qu'Apple ne lit pas toujours depuis les pods statiques)
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        // CA92.1 : réglages de l'app ; 1C8F.1 : groupe d'apps partagé avec le widget
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1', '1C8F.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
      ],
    },
  },
  // invites système (caméra, photos, contacts) et nom de l'app traduits : fichiers dans locales/
  locales: { fr: './locales/fr.json', en: './locales/en.json' },
  android: {
    package: PACKAGE,
    adaptiveIcon: {
      backgroundColor: '#FF2E5B',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // react-native-vision-camera ne déclare pas la permission CAMERA dans son manifeste : on l'ajoute nous-mêmes
    permissions: ['android.permission.CAMERA'],
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
      {
        image: './assets/splash-icon.png',
        imageWidth: 150,
        resizeMode: 'contain',
        backgroundColor: '#FF2E5B',
        // Android 12+ impose son splash : l'icône est posée dans un carré de 288 dp et coupée par un cercle de 192 dp.
        // Image carrée dédiée, glace de 161 dp de haut centrée dans le cercle (rien n'est rogné) ; LaunchSplash part de la même taille.
        android: { image: './assets/splash-icon-android.png', imageWidth: 288 },
      },
    ],
    // pas de plugin Expo : VisionCamera v5 (Nitro) s'auto-lie ; les permissions sont déclarées via ios.infoPlist + android.permissions
    [
      'expo-image-picker',
      {
        photosPermission: 'Sweetin opens your photos when you pick an image for your sweet or your profile photo.',
        cameraPermission: 'Sweetin uses the camera to take the photo for your sweet and to scan a friend’s QR code.',
        microphonePermission: false,
      },
    ],
    [
      'expo-notifications',
      {
        // petite icône Android de la barre d'état : silhouette blanche de la glace (sinon un carré blanc)
        icon: './assets/notification-icon.png',
        color: '#FF2E5B',
        sounds: ['./assets/sounds/sweet.wav', './assets/sounds/sweethour.wav', './assets/sounds/streak.wav'],
      },
    ],
    [
      'expo-contacts',
      { contactsPermission: 'Sweetin compares encrypted fingerprints of your contacts’ numbers to show you who is already on Sweetin. Nothing is stored.' },
    ],
    'expo-apple-authentication',
    'expo-asset',
    'expo-web-browser',
    'expo-secure-store',
    'expo-sharing',
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
            description: 'Tes sweets à gratter, et un raccourci pour en envoyer un.',
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
    // work-runtime-ktx 2.7.x vs work-runtime 2.8.x : classes en double (plugins/with-android-deps.ts)
    './plugins/with-android-deps',
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
