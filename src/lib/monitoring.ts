import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

/**
 * Suivi en production : plantages (Sentry) et quelques statistiques d'usage (PostHog).
 * Aucun contenu n'est jamais envoyé : ni photo, ni message, ni pseudo d'ami. Seulement des événements et des nombres.
 * Sans clés dans l'environnement, tout est désactivé.
 */
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    environment: __DEV__ ? 'development' : 'production',
  });
}

const posthog = POSTHOG_KEY ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, captureAppLifecycleEvents: true }) : null;

type Event =
  | 'signup_completed'
  | 'push_prompt'
  | 'demo_scratched'
  | 'splash_scratched'
  | 'welcome_opened'
  | 'welcome_invited'
  | 'next_tapped'
  | 'install_referrer'
  | 'flip_left_early'
  | 'welcome_scratched'
  | 'welcome_start'
  | 'review_prompt'
  | 'guest_started'
  | 'guest_signup'
  | 'streak_saved'
  | 'contacts_more'
  | 'login'
  | 'flip_sent'
  | 'flip_opened'
  | 'flip_scratched'
  | 'flip_reacted'
  | 'reply_tapped'
  | 'invite_shared'
  | 'invite_accepted'
  | 'friend_added'
  | 'screenshot_attempt'
  | 'send_failed'
  | 'send_queued'
  | 'send_deferred'
  | 'send_queue_flushed'
  | 'intro_completed'
  | 'link_shared'
  | 'story_shared'
  | 'contacts_matched'
  | 'qr_shown'
  | 'qr_scanned'
  | 'phone_verified'
  | 'friends_step_done'
  | 'invite_pasted';

/** Enregistre un événement anonyme (propriétés numériques ou booléennes seulement). */
/** Range un compte dans un groupe de test : toutes ses statistiques suivantes portent ce groupe (propriété PostHog). */
export function setTestGroup(test: string, group: string) {
  try {
    posthog?.register({ [test]: group });
  } catch {}
}

export function track(event: Event, props?: Record<string, number | boolean | string>) {
  try {
    posthog?.capture(event, props);
  } catch {}
}

/**
 * Rattache les rapports de plantage à l'identifiant technique du compte (jamais son email).
 * Les statistiques, elles, restent anonymes : elles ne sont jamais reliées au compte.
 */
export function identify(userId: string | null) {
  try {
    Sentry.setUser(userId ? { id: userId } : null);
  } catch {}
}

/** Statistiques anonymes : actives par défaut, désactivables dans Réglages (choix mémorisé sur le téléphone). */
export const analyticsAvailable = !!posthog;
export const analyticsEnabled = () => !!posthog && !posthog.optedOut;
export async function setAnalytics(on: boolean) {
  try {
    if (on) await posthog?.optIn();
    else await posthog?.optOut();
  } catch {}
}

export function report(error: unknown) {
  if (SENTRY_DSN) Sentry.captureException(error);
  else if (__DEV__) console.warn(error);
}

export const wrapRoot = <P extends Record<string, unknown>>(C: React.ComponentType<P>) => (SENTRY_DSN ? Sentry.wrap(C) : C);
