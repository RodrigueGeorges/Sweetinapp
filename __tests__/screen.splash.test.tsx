/// <reference types="jest" />
/** Splash de lancement : en mode grattage l'invite est affichée ; en mode automatique, non. */

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  performAndroidHapticsAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 1, Medium: 2, Heavy: 3, Rigid: 4, Soft: 0 },
  NotificationFeedbackType: { Success: 0 },
  AndroidHaptics: { Segment_Frequent_Tick: 1, Clock_Tick: 2, Confirm: 3 },
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
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn(), wrapRoot: (c: unknown) => c, setTestGroup: jest.fn() }));

import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { LaunchSplash } from '../src/components/LaunchSplash';
import { t } from '../src/i18n';

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});

describe('splash de lancement', () => {
  it('mode grattage : affiche l’invite à gratter', async () => {
    const { getByText } = await render(<LaunchSplash onDone={() => {}} scratch />);
    expect(getByText(t('splash.scratch'))).toBeTruthy();
  });

  it('mode automatique : pas d’invite à gratter', async () => {
    const { queryByText } = await render(<LaunchSplash onDone={() => {}} />);
    expect(queryByText(t('splash.scratch'))).toBeNull();
  });
});
