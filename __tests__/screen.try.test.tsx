/// <reference types="jest" />
/**
 * « Essayer » : le premier sweet sans compte — la caméra s'ouvre en mode invité
 * et l'événement guest_started est tracé (entonnoir d'acquisition).
 */

const mockTrack = jest.fn();
jest.mock('../src/lib/monitoring', () => ({ track: (...a: unknown[]) => mockTrack(...a) , setTestGroup: jest.fn() }));

// on vérifie le mode invité, pas la caméra elle-même (testée ailleurs)
const mockCamera = jest.fn((_props: { guest?: boolean }) => null);
jest.mock('../src/components/CameraScreen', () => ({
  CameraScreen: (props: { guest?: boolean }) => mockCamera(props),
}));

import { render } from '@testing-library/react-native';
import Try from '../src/app/try';

it('try ouvre la caméra en mode invité et trace le début du parcours', async () => {
  await render(<Try />);
  expect(mockCamera).toHaveBeenCalledWith({ guest: true });
  expect(mockTrack).toHaveBeenCalledWith('guest_started');
});
