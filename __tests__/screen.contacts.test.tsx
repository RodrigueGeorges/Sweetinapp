/// <reference types="jest" />
/**
 * « Contacts » : la liste d'amis, les séries en danger en tête, l'ajout par
 * pseudo, et les actions du menu « … » (envoyer, retirer, bloquer).
 */

jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() }, rpc: jest.fn(), auth: { getSession: jest.fn() } } }));

const mockListFriends = jest.fn(async () => [] as { id: string; username: string }[]);
const mockStreaks = jest.fn(async () => new Map());
const mockLost = jest.fn(async () => [] as { friend_id: string; days: number; can_save: boolean }[]);
const mockAddFriend = jest.fn(async (_u: string) => ({ id: 'f9', username: 'zoe' }));
const mockRemoveFriend = jest.fn(async (_id: string) => {});
const mockBlockUser = jest.fn(async (_id: string) => {});
const mockReport = jest.fn(async (_a: unknown) => {});
const mockRestoreStreak = jest.fn(async (_id: string) => {});
jest.mock('../src/lib/api', () => ({
  ...jest.requireActual('../src/lib/api'),
  listFriends: () => mockListFriends(),
  myStreaks: () => mockStreaks(),
  myLostStreaks: () => mockLost(),
  addFriend: (u: string) => mockAddFriend(u),
  removeFriend: (id: string) => mockRemoveFriend(id),
  blockUser: (id: string) => mockBlockUser(id),
  report: (a: unknown) => mockReport(a),
  restoreStreak: (id: string) => mockRestoreStreak(id),
}));

jest.mock('../src/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me' } }, profile: { username: 'moi' }, ready: true, refreshProfile: jest.fn(async () => null) }),
}));
jest.mock('../src/lib/invite', () => ({ shareInviteLink: jest.fn(async () => {}), inviteBySms: jest.fn() }));
jest.mock('../src/lib/reminders', () => ({ syncStreakReminder: jest.fn(async () => {}) }));
jest.mock('../src/lib/sounds', () => ({ play: jest.fn(), scratchLoop: { start: jest.fn(), stop: jest.fn() }, soundsEnabled: () => true, setSoundsEnabled: jest.fn() }));
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn() , setTestGroup: jest.fn() }));

// le menu « … » devient des boutons par action, pour pouvoir les tester
jest.mock('../src/components/NativeMenu', () => ({
  NativeMenu: ({ items, onSelect, children }: { items: { id: string; title: string }[]; onSelect: (id: string) => void; children?: unknown }) => {
    const React = require('react');
    const { Pressable, Text, View } = require('react-native');
    return React.createElement(
      View,
      null,
      items.map((it) => React.createElement(Pressable, { key: it.id, accessibilityLabel: it.title, onPress: () => onSelect(it.id) }, React.createElement(Text, null, it.title))),
      children,
    );
  },
}));

const mockNavigate = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), navigate: (...a: unknown[]) => mockNavigate(...a), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 1, Medium: 2, Heavy: 3 },
  NotificationFeedbackType: { Success: 0 },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null, setStatusBarStyle: jest.fn() }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children?: unknown }) => children ?? null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-svg', () => {
  const comp = ({ children }: { children?: unknown }) => children ?? null;
  return new Proxy({}, { get: () => comp });
});

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Contacts from '../src/app/(tabs)/contacts';
import { ToastProvider } from '../src/components/Toast';
import { draft } from '../src/lib/draft';
import { t } from '../src/i18n';

const renderContacts = () =>
  render(
    <ToastProvider>
      <Contacts />
    </ToastProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockListFriends.mockResolvedValue([]);
  mockStreaks.mockResolvedValue(new Map());
  mockLost.mockResolvedValue([]);
  draft.reset();
});

describe('contacts · liste', () => {
  it('sans ami → écran vide + tuiles d’invitation', async () => {
    const { findByText } = await renderContacts();
    expect(await findByText(t('contacts.emptyTitle'))).toBeTruthy();
    expect(await findByText(t('contacts.shareLink'))).toBeTruthy();
  });

  it('les amis apparaissent ; toucher une ligne prépare un sweet pour elle', async () => {
    mockListFriends.mockResolvedValue([{ id: 'f1', username: 'lea' }]);
    const { findByLabelText } = await renderContacts();
    fireEvent.press(await findByLabelText(`lea. ${t('contacts.sendFlip')}`));
    expect(draft.replyTo).toBe('f1');
    expect(draft.replyName).toBe('lea');
    expect(mockNavigate).toHaveBeenCalledWith('/camera');
  });
});

describe('contacts · séries', () => {
  it('une série perdue récupérable affiche « save it » → restoreStreak', async () => {
    mockListFriends.mockResolvedValue([{ id: 'f1', username: 'lea' }]);
    mockLost.mockResolvedValue([{ friend_id: 'f1', days: 12, can_save: true }]);
    const { findByText } = await renderContacts();
    fireEvent.press(await findByText(t('streak.save')));
    await waitFor(() => expect(mockRestoreStreak).toHaveBeenCalledWith('f1'));
    expect(await findByText(t('streak.saved'))).toBeTruthy();
  });
});

describe('contacts · ajout', () => {
  it('« add a friend » ouvre le champ ; pseudo → addFriend appelé', async () => {
    mockAddFriend.mockResolvedValue({ id: 'f9', username: 'zoe' });
    const { findByLabelText, findByText } = await renderContacts();
    fireEvent.press(await findByLabelText(t('contacts.add')));
    fireEvent.changeText(await findByLabelText(t('contacts.addPlaceholder')), 'zoe');
    fireEvent.press(await findByText(t('contacts.addBtn')));
    await waitFor(() => expect(mockAddFriend).toHaveBeenCalledWith('zoe'));
    expect(await findByText(t('contacts.added', { name: 'zoe' }))).toBeTruthy();
  });
});
