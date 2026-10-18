/// <reference types="jest" />
/**
 * Caméra · permissions : sans autorisation, le déclencheur demande l'accès
 * au lieu de capturer ; refus → toast, jamais de photo.
 * (Fichier séparé de screen.camera.test : les tests de capture laissent des
 * promesses en vol qui cassent le commit React des renders suivants.)
 */

const mockTakePicture = jest.fn();
const mockRequestPerm = jest.fn();
let mockPermGranted = false;

jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    useCameraPermissions: () => [{ granted: mockPermGranted, canAskAgain: true }, mockRequestPerm],
    CameraView: React.forwardRef((_p: unknown, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePicture, pausePreview: jest.fn(async () => {}), resumePreview: jest.fn(async () => {}) }));
      return null;
    }),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
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
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn(), wrapRoot: (c: unknown) => c , setTestGroup: jest.fn() }));
jest.mock('../src/lib/useSweetHour', () => ({ useSweetHour: () => null }));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CameraScreen } from '../src/components/CameraScreen';
import { ToastProvider } from '../src/components/Toast';
import { t } from '../src/i18n';

const renderCam = () =>
  render(
    <ToastProvider>
      <CameraScreen />
    </ToastProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockPermGranted = false;
});

describe('caméra · permissions', () => {
  it('sans permission, le déclencheur demande l’accès au lieu de capturer', async () => {
    mockRequestPerm.mockResolvedValue({ granted: true });
    const { getByLabelText } = await renderCam();
    fireEvent.press(getByLabelText(t('camera.allow')));
    await waitFor(() => expect(mockRequestPerm).toHaveBeenCalledTimes(1));
    expect(mockTakePicture).not.toHaveBeenCalled();
  });

  it('permission refusée → toast, pas de capture', async () => {
    mockRequestPerm.mockResolvedValue({ granted: false, canAskAgain: false });
    const { getByLabelText, findByText } = await renderCam();
    fireEvent.press(getByLabelText(t('camera.allow')));
    expect(await findByText(t('camera.permissionDenied'))).toBeTruthy();
    expect(mockTakePicture).not.toHaveBeenCalled();
  });

  it('l’écran sans permission montre le panneau explicatif', async () => {
    const { getByText } = await renderCam();
    expect(getByText(t('camera.needPermission'))).toBeTruthy();
    expect(getByText(t('camera.needPermissionSub'))).toBeTruthy();
  });
});
