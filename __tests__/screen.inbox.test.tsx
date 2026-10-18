/// <reference types="jest" />
/**
 * « Vitrine » : reçus / envoyés, file d'attente hors connexion, déclencheur,
 * navigation vers la lecture. L'écran où l'on vit.
 */

import type { InboxItem } from '../src/lib/api';

let mockInboxItems: InboxItem[] = [];
let mockInboxLoading = false;
const mockInboxRefresh = jest.fn(async () => {});
jest.mock('../src/lib/useInbox', () => ({ useInbox: () => ({ items: mockInboxItems, loading: mockInboxLoading, refresh: mockInboxRefresh }) }));

jest.mock('../src/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me' } }, profile: { username: 'moi' }, ready: true, refreshProfile: jest.fn(async () => null) }),
}));

jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() }, rpc: jest.fn(), auth: { getSession: jest.fn() } } }));
jest.mock('../src/lib/api', () => ({
  ...jest.requireActual('../src/lib/api'),
  listFriends: jest.fn(async () => [{ id: 'f1', username: 'lea' }]),
  myStreaks: jest.fn(async () => new Map()),
  listSent: jest.fn(async () => []),
  listLinks: jest.fn(async () => []),
}));

const mockPending = jest.fn(async () => [] as import('../src/lib/sendQueue').QueuedSend[]);
const mockRemoveQueuedAt = jest.fn(async (_i: number) => {});
jest.mock('../src/lib/sendQueue', () => ({
  pendingSends: () => mockPending(),
  removeQueuedAt: (i: number) => mockRemoveQueuedAt(i),
  onQueueChange: () => () => {},
  queueSend: jest.fn(async () => {}),
}));

jest.mock('../src/lib/useSweetHour', () => ({ useSweetHour: () => null }));
jest.mock('../src/lib/welcome', () => ({ isWelcome: () => false, useWelcome: () => false, welcomeItem: jest.fn() }));
jest.mock('../src/lib/invite', () => ({ shareInviteLink: jest.fn(async () => {}), inviteBySms: jest.fn() }));
jest.mock('../src/lib/thumb', () => ({ thumbhashOf: () => null }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));

const mockPush = jest.fn();
const mockLinkNav = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  const Link = ({ href, children, asChild }: { href: string; children?: React.ReactElement; asChild?: boolean }) =>
    asChild && React.isValidElement(children)
      ? React.cloneElement(children, { onPress: () => mockLinkNav(href) })
      : React.createElement(Pressable, { onPress: () => mockLinkNav(href) }, children);
  Link.AppleZoom = ({ children }: { children?: unknown }) => children ?? null;
  Link.AppleZoomTarget = ({ children }: { children?: unknown }) => children ?? null;
  return {
    Link,
    router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    useFocusEffect: (cb: () => void) => React.useEffect(cb, []),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const chain = (): unknown => new Proxy(function () {}, { get: () => chain(), apply: () => chain() });
  return { Gesture: new Proxy({}, { get: () => chain }), GestureDetector: ({ children }: { children?: unknown }) => children ?? null };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 1, Medium: 2, Heavy: 3 },
}));
jest.mock('expo-image', () => {
  const Image = () => null;
  Image.prefetch = jest.fn(async () => true);
  return { Image };
});
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('expo-glass-effect', () => ({ GlassView: () => null, isLiquidGlassAvailable: () => false }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null, setStatusBarStyle: jest.fn() }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children?: unknown }) => children ?? null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const RNText = require('react-native').Text;
  const comp = ({ children }: { children?: unknown }) => children ?? null;
  const text = ({ children }: { children?: unknown }) => React.createElement(RNText, null, children);
  return new Proxy({}, { get: (_t, name) => (name === 'Text' || name === 'TextPath' ? text : comp) });
});
jest.mock('../src/lib/sounds', () => ({ play: jest.fn(), scratchLoop: { start: jest.fn(), stop: jest.fn() }, soundsEnabled: () => true, setSoundsEnabled: jest.fn() }));

import { fireEvent, render } from '@testing-library/react-native';
import Inbox from '../src/app/(tabs)/inbox';
import { ToastProvider } from '../src/components/Toast';
import { t } from '../src/i18n';
import { ago } from '../src/lib/format';

const item: InboxItem = {
  flip_id: 'flip9',
  created_at: new Date().toISOString(),
  mode: 'free',
  sender: { id: 'f1', username: 'lea' },
  opened: false,
  preview: 'b64',
};

const renderInbox = () =>
  render(
    <ToastProvider>
      <Inbox />
    </ToastProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockInboxItems = [];
  mockInboxLoading = false;
});

describe('inbox · reçus', () => {
  it('aucun sweet → écran vide avec invitation à partager', async () => {
    const { findByText } = await renderInbox();
    expect(await findByText(t('inbox.emptyTitle'))).toBeTruthy();
    expect(await findByText(t('inbox.emptyCta'))).toBeTruthy();
  });

  it('un sweet reçu → la carte héro ouvre la lecture', async () => {
    mockInboxItems = [item];
    const { findByLabelText } = await renderInbox();
    const hero = await findByLabelText(t('inbox.open', { name: 'lea', ago: ago(item.created_at) }));
    fireEvent.press(hero);
    expect(mockLinkNav).toHaveBeenCalledWith('/read/flip9');
  });
});

describe('inbox · envoyés', () => {
  it('onglet envoyés : rien → message vide', async () => {
    const { findByLabelText, findByText } = await renderInbox();
    fireEvent.press(await findByLabelText(t('inbox.sent')));
    expect(await findByText(t('inbox.sentEmpty'))).toBeTruthy();
  });

  it('un envoi en file est visible et annulable par appui long', async () => {
    mockPending.mockResolvedValue([{ localUri: 'file:///x.jpg', message: 'hey', mode: 'free', recipients: ['f1'], preview: null, queued_at: Date.now() }]);
    const { findByLabelText } = await renderInbox();
    fireEvent.press(await findByLabelText(t('inbox.sent')));
    const row = await findByLabelText('lea'); // nom résolu via la liste d'amis
    fireEvent(row, 'longPress');
    expect(mockRemoveQueuedAt).toHaveBeenCalledWith(0);
  });
});

describe('inbox · déclencheur', () => {
  it('le déclencheur ouvre la caméra', async () => {
    const { findByLabelText } = await renderInbox();
    fireEvent.press(await findByLabelText(t('inbox.shoot')));
    expect(mockPush).toHaveBeenCalledWith('/camera');
  });
});
