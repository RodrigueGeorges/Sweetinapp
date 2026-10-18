/// <reference types="jest" />
/**
 * « Envoyer à » : sélection d'amis, CTA contextuel, envoi réussi → célébration,
 * hors connexion → file d'attente. C'est le point de jonction de toute l'app.
 */

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    rpc: jest.fn(),
    auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'me' } } } })) },
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
  },
}));

// le vrai ApiError (instanceof dans sendto), les fonctions réseau mockées
jest.mock('../src/lib/api', () => ({
  ...jest.requireActual('../src/lib/api'),
  listFriends: jest.fn(async () => [
    { id: 'f1', username: 'lea' },
    { id: 'f2', username: 'marco' },
  ]),
  myStreaks: jest.fn(async () => new Map()),
  sendFlip: jest.fn(),
  forgetLocalPhoto: jest.fn(),
}));

const mockQueueSend = jest.fn(async (_input: unknown) => {});
jest.mock('../src/lib/sendQueue', () => ({ queueSend: (input: unknown) => mockQueueSend(input) }));
jest.mock('../src/lib/preview', () => ({ makePreview: jest.fn(async () => 'b64preview') }));
jest.mock('../src/lib/story', () => ({ renderStoryImage: jest.fn(), shareStory: jest.fn() }));
jest.mock('../src/lib/invite', () => ({ inviteBySms: jest.fn(async () => true) }));
jest.mock('../src/lib/push', () => ({ shouldAskPush: jest.fn(async () => true), registerForPush: jest.fn(async () => {}) }));
jest.mock('../src/lib/haptics', () => ({ signature: jest.fn(), tick: jest.fn(), heat: jest.fn(), melt: jest.fn() }));
jest.mock('../src/lib/sounds', () => ({ play: jest.fn(), initSounds: jest.fn(), scratchLoop: { start: jest.fn(), stop: jest.fn() }, soundsEnabled: () => true, setSoundsEnabled: jest.fn() }));
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn(), wrapRoot: (c: unknown) => c , setTestGroup: jest.fn() }));
jest.mock('../src/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me' } }, profile: { username: 'moi', onboarded: true }, ready: true, refreshProfile: jest.fn(async () => null) }),
}));

const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: (...a: unknown[]) => mockReplace(...a), dismissAll: () => mockDismissAll(), canDismiss: () => true, navigate: jest.fn(), canGoBack: () => true },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
  Link: ({ children }: { children?: unknown }) => children ?? null,
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 1, Medium: 2, Heavy: 3, Rigid: 4, Soft: 0 },
  NotificationFeedbackType: { Error: 2, Success: 0 },
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
  SafeAreaProvider: ({ children }: { children?: unknown }) => children,
}));
jest.mock('react-native-svg', () => {
  const comp = ({ children }: { children?: unknown }) => children ?? null;
  return new Proxy({}, { get: () => comp });
});

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SendTo from '../src/app/sendto';
import { ApiError, sendFlip } from '../src/lib/api';
import { draft } from '../src/lib/draft';
import { ToastProvider } from '../src/components/Toast';
import { t } from '../src/i18n';

const renderSend = () =>
  render(
    <ToastProvider>
      <SendTo />
    </ToastProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockQueueSend.mockResolvedValue(undefined);
  draft.reset();
  draft.setPhoto('file:///shot.jpg');
  draft.setMessage('coucou', false);
});

describe('sendto · sélection', () => {
  it('choisir une amie met à jour le CTA avec son pseudo', async () => {
    const { findByLabelText, findByText } = await renderSend();
    fireEvent.press(await findByLabelText('lea'));
    expect(await findByText(t('send.ctaTo', { name: 'lea' }))).toBeTruthy();
  });

  it('sans sélection ni lien, envoyer ne part pas', async () => {
    const { findByText } = await renderSend();
    fireEvent.press(await findByText(t('send.pick')));
    // même si le press arrive au handler, le garde bloque l'envoi
    expect(sendFlip).not.toHaveBeenCalled();
  });
});

describe('sendto · envoi', () => {
  it('envoi réussi → célébration + reset du brouillon + sortie vers inbox', async () => {
    (sendFlip as jest.Mock).mockResolvedValue({ id: 'flip1', sent_to: 1, sweet_hour: false, link_url: null, link: null, streak: 3 });
    const { findByLabelText, findByText } = await renderSend();
    fireEvent.press(await findByLabelText('lea'));
    fireEvent.press(await findByText(t('send.ctaTo', { name: 'lea' })));

    await waitFor(() => expect(sendFlip).toHaveBeenCalledTimes(1));
    expect((sendFlip as jest.Mock).mock.calls[0]![0]).toMatchObject({ recipients: ['f1'], message: 'coucou' });
    expect(await findByText(t('send.sent'))).toBeTruthy();
    expect(draft.uri).toBe(''); // brouillon consommé
    // la demande push est proposée → « non merci » referme vers l'inbox
    fireEvent.press(await findByText(t('notif.later')));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/inbox'));
  });

  it('hors connexion → le sweet va dans la file, pas d’échec', async () => {
    (sendFlip as jest.Mock).mockRejectedValue(new ApiError('OFFLINE', 'no network', true));
    const { findByLabelText, findByText } = await renderSend();
    fireEvent.press(await findByLabelText('marco'));
    fireEvent.press(await findByText(t('send.ctaTo', { name: 'marco' })));

    await waitFor(() => expect(mockQueueSend).toHaveBeenCalledTimes(1));
    expect(mockQueueSend.mock.calls[0][0]).toMatchObject({ recipients: ['f2'], message: 'coucou' });
    expect(draft.uri).toBe('');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/inbox'));
  });
});
