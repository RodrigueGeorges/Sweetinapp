import { t } from '../i18n';
import { listFriends, myStreaks } from './api';
import { notif } from './notif';

const ID = 'sweetin.streakReminder';
/** Heure locale du rappel : assez tard pour l'effet de rareté, assez tôt pour agir. */
const HOUR = 20;

/**
 * Rappel local « ta série fond ce soir » vers 20 h, dans le vrai fuseau de l'appareil
 * (le push serveur part à 19 h, heure de Paris). Une seule notification, la plus longue
 * série en danger ; recalculée à chaque chargement des séries — jamais de doublon.
 * Ne demande jamais la permission : sans elle, le rappel serveur suffit.
 */
export async function syncStreakReminder() {
  try {
    const N = notif();
    if (!N) return;
    const [perm, scheduled] = await Promise.all([N.getPermissionsAsync(), N.getAllScheduledNotificationsAsync()]);
    for (const n of scheduled) {
      if (n.identifier === ID) await N.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
    }
    if (!perm.granted) return;

    // trop tard pour prévenir utilement aujourd'hui : le push serveur est déjà passé
    const at = new Date();
    if (at.getHours() >= HOUR) return;
    at.setHours(HOUR, 0, 0, 0);

    const [streaks, friends] = await Promise.all([myStreaks(), listFriends()]);
    const risk = friends.filter((f) => streaks.get(f.id)?.at_risk).map((f) => ({ name: f.username, days: streaks.get(f.id)!.days }));
    risk.sort((a, b) => b.days - a.days);
    if (!risk.length) return;

    await N.scheduleNotificationAsync({
      identifier: ID,
      content: {
        title: t('streak.reminderTitle'),
        body: risk.length === 1 ? t('streak.reminderOne', { name: risk[0].name, n: risk[0].days }) : t('streak.reminderMany', { n: risk.length }),
        sound: 'streak.wav',
        data: { screen: 'contacts', kind: 'streak-local' },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'streaks' },
    });
  } catch {
    // notifications indisponibles (Expo Go, web) : rien à faire
  }
}
