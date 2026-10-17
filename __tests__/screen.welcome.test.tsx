/// <reference types="jest" />
/** Parcours d'accueil : la promesse, la démo à gratter, puis commencer / se connecter. */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    canGoBack: () => false,
  },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
  Link: ({ children }: { children?: unknown }) => children ?? null,
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 1, Medium: 2, Heavy: 3, Rigid: 4, Soft: 0 },
}));
jest.mock('expo-image', () => ({ Image: () => null, prefetch: jest.fn(async () => true) }));
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
jest.mock('react-native-gesture-handler', () => {
  const chain = (): unknown => new Proxy(function () {}, { get: () => chain(), apply: () => chain() });
  return {
    Gesture: { Pinch: chain, Tap: chain, Pan: chain, Simultaneous: chain },
    GestureDetector: ({ children }: { children?: unknown }) => children ?? null,
    GestureHandlerRootView: ({ children }: { children?: unknown }) => children,
  };
});
jest.mock('../src/lib/sounds', () => ({ play: jest.fn(), initSounds: jest.fn(), scratchLoop: { start: jest.fn(), stop: jest.fn() }, soundsEnabled: () => true, setSoundsEnabled: jest.fn() }));
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn(), wrapRoot: (c: unknown) => c }));

import { fireEvent, render } from '@testing-library/react-native';
import Welcome from '../src/app/welcome';
import { t } from '../src/i18n';

describe('accueil', () => {
  it('affiche la promesse, la démo et les deux portes d’entrée', async () => {
    const { getByText } = await render(<Welcome />);
    expect(getByText(t('welcome.tagline'))).toBeTruthy();
    expect(getByText(t('welcome.start'))).toBeTruthy();
    expect(getByText(t('welcome.login'))).toBeTruthy();
  });

  it('« commencer » ouvre l’essai sans compte, « me connecter » ouvre l’auth login', async () => {
    const { getByText } = await render(<Welcome />);
    fireEvent.press(getByText(t('welcome.start')));
    expect(mockPush).toHaveBeenCalledWith('/try');
    fireEvent.press(getByText(t('welcome.login')));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/auth', params: { mode: 'login' } });
  });
});
