import * as Notifications from 'expo-notifications';
import { syncStreakReminder } from '../src/lib/reminders';
import * as api from '../src/lib/api';

// expo-notifications : on simule permission + planification en mémoire
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('../src/lib/api', () => ({
  myStreaks: jest.fn(),
  listFriends: jest.fn(),
}));

const mocked = jest.mocked(api);
const notif = jest.mocked(Notifications);

const lea = { id: 'u1', username: 'lea', avatar_url: null };
const max = { id: 'u2', username: 'max', avatar_url: null };

function streaks(map: Record<string, { days: number; at_risk: boolean }>) {
  return new Map(Object.entries(map).map(([id, s]) => [id, { friend_id: id, ...s }]));
}

beforeEach(() => {
  jest.clearAllMocks();
  // l'heure est figée à 10 h : le rappel de 20 h est toujours planifiable
  jest.useFakeTimers().setSystemTime(new Date().setHours(10, 0, 0, 0));
  mocked.listFriends.mockResolvedValue([lea, max] as never);
  notif.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
  notif.getAllScheduledNotificationsAsync.mockResolvedValue([] as never);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('syncStreakReminder', () => {
  test('planifie un rappel à 20 h pour la plus longue série en danger', async () => {
    mocked.myStreaks.mockResolvedValue(streaks({ u1: { days: 12, at_risk: true }, u2: { days: 3, at_risk: true } }) as never);
    await syncStreakReminder();
    expect(notif.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const req = notif.scheduleNotificationAsync.mock.calls[0][0];
    expect(req.content.data?.kind).toBe('streak-local');
    // la notif est groupée : les deux séries sont comptées
    expect(req.content.body).toContain('2');
    const date = (req.trigger as { date: Date }).date;
    expect(date.getHours()).toBe(20);
    expect(date.getMinutes()).toBe(0);
  });

  test('annule le rappel existant quand plus aucune série n’est en danger', async () => {
    notif.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'sweetin.streakReminder' } as never]);
    mocked.myStreaks.mockResolvedValue(streaks({ u1: { days: 12, at_risk: false }, u2: { days: 3, at_risk: false } }) as never);
    await syncStreakReminder();
    expect(notif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('sweetin.streakReminder');
    expect(notif.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('ne fait rien sans permission de notification', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
    mocked.myStreaks.mockResolvedValue(streaks({ u1: { days: 12, at_risk: true } }) as never);
    await syncStreakReminder();
    expect(notif.scheduleNotificationAsync).not.toHaveBeenCalled();
    // pas de requêtes réseau inutiles : on s'arrête avant de charger les séries
    expect(mocked.myStreaks).not.toHaveBeenCalled();
  });

  test('annule le rappel existant puis replanifie (pas de doublon)', async () => {
    notif.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'sweetin.streakReminder' } as never]);
    mocked.myStreaks.mockResolvedValue(streaks({ u1: { days: 12, at_risk: true }, u2: { days: 3, at_risk: false } }) as never);
    await syncStreakReminder();
    expect(notif.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notif.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notif.scheduleNotificationAsync.mock.calls[0][0].content.body).toContain('lea');
  });
});
