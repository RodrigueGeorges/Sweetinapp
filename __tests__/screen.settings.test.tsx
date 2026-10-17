/// <reference types="jest" />
/**
 * « Réglages » : profil affiché, interrupteurs (sons, notifications, visibilité),
 * déconnexion propre (push désinscrit + widget vidé + signOut), suppression de
 * compte derrière une confirmation.
 */

const mockSignOut = jest.fn(async () => ({}));
jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { signOut: () => mockSignOut(), getSession: jest.fn() }, functions: { invoke: jest.fn() }, rpc: jest.fn() },
}));

const mockDeleteAccount = jest.fn(async () => {});
const mockSetDiscoverable = jest.fn(async (_v: boolean) => {});
const mockSetAvatar = jest.fn(async (_u: string) => {});
jest.mock('../src/lib/api', () => ({
  ...jest.requireActual('../src/lib/api'),
  deleteAccount: () => mockDeleteAccount(),
  mySettings: jest.fn(async () => ({ discoverable: true, has_phone: false })),
  setAvatar: (u: string) => mockSetAvatar(u),
  setDiscoverable: (v: boolean) => mockSetDiscoverable(v),
}));

const mockUnregisterPush = jest.fn(async () => {});
const mockSetPushWanted = jest.fn(async (_v: boolean, _id?: string) => {});
jest.mock('../src/lib/push', () => ({
  shouldAskPush: jest.fn(async () => false),
  pushWanted: jest.fn(async () => true),
  setPushWanted: (v: boolean, id?: string) => mockSetPushWanted(v, id),
  registerForPush: jest.fn(async () => {}),
  unregisterPush: () => mockUnregisterPush(),
}));

const mockUpdateWidget = jest.fn((_a: unknown) => {});
jest.mock('../src/lib/widget', () => ({ updateWidget: (a: unknown) => mockUpdateWidget(a), widgetStateFrom: jest.fn(), readWidgetState: jest.fn(async () => null), APP_GROUP: 'group.test', WIDGET_KEY: 'k' }));
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn(), analyticsAvailable: false, analyticsEnabled: () => false, setAnalytics: jest.fn(async () => {}), identify: jest.fn(), report: jest.fn() }));
jest.mock('../src/lib/sounds', () => ({ play: jest.fn(), scratchLoop: { start: jest.fn(), stop: jest.fn() }, soundsEnabled: () => true, setSoundsEnabled: jest.fn(async () => {}) }));
jest.mock('../src/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'me', email: 'moi@test.fr' } }, profile: { username: 'moi' }, ready: true, refreshProfile: jest.fn(async () => null) }),
}));
jest.mock('../src/components/AvatarPicker', () => ({ pickSelfie: jest.fn(async () => null) }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0', extra: {} } }));

const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: (...a: unknown[]) => mockReplace(...a), dismissAll: () => mockDismissAll(), canGoBack: () => true },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

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
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(), MediaTypeOptions: { Images: 'images' } }));
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
import { Alert } from 'react-native';
import Settings from '../src/app/settings';
import { ToastProvider } from '../src/components/Toast';
import { setSoundsEnabled } from '../src/lib/sounds';
import { t } from '../src/i18n';

const renderSettings = () =>
  render(
    <ToastProvider>
      <Settings />
    </ToastProvider>,
  );

beforeEach(() => jest.clearAllMocks());

describe('settings · compte', () => {
  it('affiche le pseudo et l’email', async () => {
    const { findByText } = await renderSettings();
    expect(await findByText('@moi')).toBeTruthy();
    expect(await findByText('moi@test.fr')).toBeTruthy();
  });

  it('couper les sons appelle setSoundsEnabled', async () => {
    const { findByLabelText } = await renderSettings();
    fireEvent(await findByLabelText(t('settings.sounds')), 'valueChange', false);
    expect(setSoundsEnabled).toHaveBeenCalledWith(false);
  });

  it('l’interrupteur notifications informe le serveur du choix', async () => {
    const { findByLabelText } = await renderSettings();
    fireEvent(await findByLabelText(t('settings.notifs')), 'valueChange', false);
    expect(mockSetPushWanted).toHaveBeenCalledWith(false, 'me');
  });
});

describe('settings · départ', () => {
  it('déconnexion : push désinscrit, widget vidé, signOut, retour welcome', async () => {
    const { findByText } = await renderSettings();
    fireEvent.press(await findByText(t('settings.logout')));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/welcome'));
    expect(mockUnregisterPush).toHaveBeenCalled();
    expect(mockUpdateWidget).toHaveBeenCalledWith([]);
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockDismissAll).toHaveBeenCalled();
  });

  it('suppression : confirmation puis deleteAccount + déconnexion complète', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const { findByText } = await renderSettings();
    fireEvent.press(await findByText(t('settings.delete')));
    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalled());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/welcome'));
    expect(await findByText(t('settings.deleted'))).toBeTruthy();
    spy.mockRestore();
  });
});
