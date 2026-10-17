/// <reference types="jest" />
/**
 * Parcours caméra (le plus fragile : module natif + gestes + transitions).
 * Régression couverte : l'aperçu ne doit JAMAIS se suspendre avant que la photo
 * soit prise — sur plusieurs appareils Android, suspendre pendant la capture l'avorte.
 */

const mockTakePicture = jest.fn();
const mockPausePreview = jest.fn(async () => {});
const mockResumePreview = jest.fn(async () => {});
const mockRequestPerm = jest.fn();
let mockPermGranted = true;

jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    useCameraPermissions: () => [{ granted: mockPermGranted }, mockRequestPerm],
    CameraView: React.forwardRef((_p: unknown, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePicture, pausePreview: mockPausePreview, resumePreview: mockResumePreview }));
      return null;
    }),
  };
});

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  // closures paresseuses : la factory s'évalue avant l'init des mocks (hoisting)
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    back: (...a: unknown[]) => mockBack(...a),
    replace: jest.fn(),
    navigate: jest.fn(),
    canGoBack: () => true,
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
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })) }));
jest.mock('expo-image', () => {
  const Image = () => null;
  Image.prefetch = jest.fn(async () => true);
  return { Image, prefetch: Image.prefetch };
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
jest.mock('../src/lib/useSweetHour', () => ({ useSweetHour: () => null }));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CameraScreen } from '../src/components/CameraScreen';
import { draft } from '../src/lib/draft';
import { ToastProvider } from '../src/components/Toast';
import { t } from '../src/i18n';

const renderCam = () =>
  render( // RNTL 14 : render est async (act + createRoot React 19)
    <ToastProvider>
      <CameraScreen />
    </ToastProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockPermGranted = true;
  draft.reset();
});

describe('caméra · déclenchement', () => {
  it('prend la photo PUIS fige l’aperçu (ordre garanti), puis ouvre la carte', async () => {
    // si mockPausePreview part avant la fin de mockTakePicture, la capture est morte
    mockTakePicture.mockImplementation(() => {
      expect(mockPausePreview).not.toHaveBeenCalled();
      return Promise.resolve({ uri: 'file:///shot.jpg' });
    });

    const { getByLabelText } = await renderCam();
    fireEvent.press(getByLabelText(t('camera.a11yShoot')));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/create'));
    expect(mockTakePicture).toHaveBeenCalledTimes(1);
    expect(mockPausePreview).toHaveBeenCalledTimes(1); // figé APRÈS la capture, pas pendant
    expect(draft.uri).toBe('file:///shot.jpg');
  });

  it('ne part pas deux fois si on martèle le déclencheur', async () => {
    mockTakePicture.mockImplementation(() => new Promise((r) => setTimeout(() => r({ uri: 'file:///a.jpg' }), 60)));
    const { getByLabelText } = await renderCam();
    const shutter = getByLabelText(t('camera.a11yShoot'));
    fireEvent.press(shutter);
    fireEvent.press(shutter);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/create'));
    expect(mockTakePicture).toHaveBeenCalledTimes(1);
  });
});
