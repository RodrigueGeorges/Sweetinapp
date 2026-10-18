/// <reference types="jest" />
/**
 * « Lire » : ouvrir le sweet, gratter (ou lire sans gratter), le mot fond,
 * réagir, répondre. Chemin d'erreur : déjà lu → écran de marque.
 *
 * ScratchCard (Skia) est mocké : le test pilote ses callbacks onReveal/onProgress,
 * ce qui simule le geste sans simuler la surface.
 */

import type { OpenedFlip } from '../src/lib/api';

jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() }, rpc: jest.fn(), auth: { getSession: jest.fn() } } }));

const mockOpenFlip = jest.fn(async (_id: string): Promise<OpenedFlip> => ({} as OpenedFlip));
const mockMarkScratched = jest.fn(async (_id: string, _p: number, _ms: number) => {});
const mockReact = jest.fn(async (_id: string, _e: string) => {});
const mockReportScreenshot = jest.fn(async (_id: string) => {});
jest.mock('../src/lib/api', () => ({
  ...jest.requireActual('../src/lib/api'),
  openFlip: (id: string) => mockOpenFlip(id),
  markScratched: (id: string, p: number, ms: number) => mockMarkScratched(id, p, ms),
  react: (id: string, e: string) => mockReact(id, e),
  report: jest.fn(async () => {}),
  reportScreenshot: (id: string) => mockReportScreenshot(id),
}));

jest.mock('../src/lib/image', () => ({ loadImageInMemory: jest.fn(async () => ({ dispose: jest.fn(), width: () => 10, height: () => 10 })) }));
jest.mock('../src/lib/thumb', () => ({ thumbhashOf: () => null }));
jest.mock('../src/lib/review', () => ({ countRead: jest.fn(), maybeAskReview: jest.fn() }));
jest.mock('../src/lib/haptics', () => ({ heat: jest.fn(), melt: jest.fn(), tick: jest.fn(), signature: jest.fn() }));
jest.mock('../src/lib/sounds', () => ({ play: jest.fn(), scratchLoop: { start: jest.fn(), stop: jest.fn() }, soundsEnabled: () => true, setSoundsEnabled: jest.fn() }));
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn() , setTestGroup: jest.fn() }));
jest.mock('../src/lib/useTilt', () => ({ useTilt: () => ({ x: { value: 0 }, y: { value: 0 } }) }));

// ScratchCard simulé : un bouton « grattage » déclenche onReveal, comme le ferait le doigt
jest.mock('../src/components/ScratchCard', () => ({
  ScratchCard: ({ onReveal }: { onReveal?: (percent: number, ms: number) => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(Pressable, { accessibilityLabel: 'zone de grattage', onPress: () => onReveal?.(62, 3400) }, React.createElement(Text, null, 'photo à gratter'));
  },
}));

jest.mock('../src/components/NativeMenu', () => ({
  NativeMenu: ({ children }: { children?: unknown }) => children ?? null,
}));

jest.mock('expo-screen-capture', () => ({
  usePreventScreenCapture: jest.fn(),
  useScreenshotListener: jest.fn(),
  enableAppSwitcherProtectionAsync: jest.fn(async () => {}),
  disableAppSwitcherProtectionAsync: jest.fn(async () => {}),
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: () => mockBack(), replace: (...a: unknown[]) => mockReplace(...a), dismissAll: jest.fn(), canDismiss: () => true, canGoBack: () => true },
  useLocalSearchParams: () => ({ id: 'flip9' }),
  Link: Object.assign(
    ({ children }: { children?: unknown }) => children ?? null,
    { AppleZoom: ({ children }: { children?: unknown }) => children ?? null, AppleZoomTarget: ({ children }: { children?: unknown }) => children ?? null },
  ),
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

import { fireEvent, render } from '@testing-library/react-native';
import Read from '../src/app/read/[id]';
import { ToastProvider } from '../src/components/Toast';
import { draft } from '../src/lib/draft';
import { t } from '../src/i18n';

const flip: OpenedFlip = {
  id: 'flip9',
  sender: 'lea',
  sender_id: 'f1',
  photo_url: 'https://cdn.test/p.jpg',
  message: 'coucou',
  mode: 'free',
  created_at: new Date().toISOString(),
  preview: null,
} as OpenedFlip;

const renderRead = () =>
  render(
    <ToastProvider>
      <Read />
    </ToastProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  draft.reset();
});

describe('read · lecture', () => {
  it('le sweet se charge → « gratte. » invite à gratter', async () => {
    mockOpenFlip.mockResolvedValue(flip);
    const { findByText, findByLabelText } = await renderRead();
    expect(await findByText(t('inbox.scratch'))).toBeTruthy();
    expect(await findByLabelText('zone de grattage')).toBeTruthy();
  });

  it('gratter révèle le mot, notifie le serveur, affiche le compte à rebours', async () => {
    mockOpenFlip.mockResolvedValue(flip);
    const { findByLabelText, findByText } = await renderRead();
    fireEvent.press(await findByLabelText('zone de grattage'));
    expect(mockMarkScratched).toHaveBeenCalledWith('flip9', 62, 3400);
    expect(await findByLabelText(t('read.meltsIn', { s: 10 }))).toBeTruthy();
  });

  it('« répondre » prépare la réponse et repart vers la caméra', async () => {
    mockOpenFlip.mockResolvedValue(flip);
    const { findByLabelText, findByText } = await renderRead();
    fireEvent.press(await findByLabelText('zone de grattage'));
    fireEvent.press(await findByText(t('read.reply')));
    expect(draft.replyTo).toBe('f1');
    expect(mockReplace).toHaveBeenCalledWith('/camera');
  });
});

describe('read · erreur', () => {
  it('sweet déjà gratté → écran de marque, retour vers l’inbox', async () => {
    mockOpenFlip.mockRejectedValue(new Error('already read'));
    const { findByText } = await renderRead();
    expect(await findByText(t('read.errSub'))).toBeTruthy();
    fireEvent.press(await findByText(t('read.errBack')));
    expect(mockReplace).toHaveBeenCalledWith('/inbox');
  });
});
