/// <reference types="jest" />
/**
 * « Créer » : recto photo → validation → verso secret → suite.
 * Le pivot du parcours : sans compte on part vers l'inscription (brouillon gardé),
 * avec un compte on file vers « envoyer à ».
 */

let mockSession: unknown = { user: { id: 'me' } };
jest.mock('../src/lib/session', () => ({
  useSession: () => ({ session: mockSession, profile: null, ready: true, refreshProfile: jest.fn(async () => null) }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), replace: jest.fn(), canGoBack: () => true },
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
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
jest.mock('../src/lib/sounds', () => ({ play: jest.fn(), scratchLoop: { start: jest.fn(), stop: jest.fn() }, soundsEnabled: () => true, setSoundsEnabled: jest.fn() }));
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn() , setTestGroup: jest.fn() }));

import { fireEvent, render } from '@testing-library/react-native';
import Create from '../src/app/create';
import { draft } from '../src/lib/draft';
import { t } from '../src/i18n';

beforeEach(() => {
  jest.clearAllMocks();
  draft.reset();
  mockSession = { user: { id: 'me' } };
});

describe('create · garde-fou', () => {
  it('sans photo, un membre repart vers la caméra', async () => {
    await render(<Create />);
    expect(mockRedirect).toHaveBeenCalledWith('/camera');
  });

  it('sans photo ni compte, un invité repart vers l’essai', async () => {
    mockSession = null;
    await render(<Create />);
    expect(mockRedirect).toHaveBeenCalledWith('/try');
  });
});

describe('create · recto → verso', () => {
  it('« garder la photo » retourne la carte sur le secret', async () => {
    draft.setCameraPhoto('file:///shot.jpg');
    const { findByLabelText, findByLabelText: find2 } = await render(<Create />);
    fireEvent.press(await findByLabelText(t('create.validate')));
    // verso : le champ secret devient saisissable
    expect(await find2(t('create.secretA11y'))).toBeTruthy();
  });

  it('le CTA « suivant » reste désactivé tant que le secret est vide', async () => {
    draft.setCameraPhoto('file:///shot.jpg');
    const { findByLabelText, findByText } = await render(<Create />);
    fireEvent.press(await findByLabelText(t('create.validate')));
    const cta = await findByText(t('create.next'));
    fireEvent.press(cta);
    expect(mockPush).not.toHaveBeenCalled();
    expect(draft.message).toBe('');
  });
});

describe('create · suite du parcours', () => {
  const fillAndNext = async (screen: Awaited<ReturnType<typeof render>>) => {
    fireEvent.press(await screen.findByLabelText(t('create.validate')));
    fireEvent.changeText(await screen.findByLabelText(t('create.secretA11y')), 'secret !');
    fireEvent.press(await screen.findByText(t('create.next')));
  };

  it('membre : message enregistré → /sendto', async () => {
    draft.setCameraPhoto('file:///shot.jpg');
    const screen = await render(<Create />);
    await fillAndNext(screen);
    expect(draft.message).toBe('secret !');
    expect(mockPush).toHaveBeenCalledWith('/sendto');
  });

  it('invité : brouillon sauvegardé → /auth en mode signup avec suite=send', async () => {
    mockSession = null;
    draft.setPhoto('file:///shot.jpg');
    const screen = await render(<Create />);
    await fillAndNext(screen);
    expect(draft.message).toBe('secret !');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/auth', params: { mode: 'signup', next: 'send' } });
  });
});
