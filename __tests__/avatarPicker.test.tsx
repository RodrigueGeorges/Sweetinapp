import { act, renderHook } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useSelfiePicker } from '../src/components/AvatarPicker';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///avatar.jpg' }] })),
}));
jest.mock('../src/components/Icon', () => ({ Icon: () => null }));
jest.mock('../src/components/Sheet', () => ({ Sheet: () => null }));
type Callbacks = { onSelect: (id: string) => void; onDismiss: () => void };

beforeEach(() => jest.clearAllMocks());

test('la sélection restitue la photo après fermeture du panneau', async () => {
  const { result } = await renderHook(() => useSelfiePicker());
  let picked!: Promise<string | null>;
  await act(async () => { picked = result.current.pick(); });
  const props = (result.current.sheet as ReactElement<Callbacks>).props;
  await act(async () => { props.onSelect('library'); props.onDismiss(); });
  expect(await Promise.race([picked, new Promise((resolve) => setTimeout(() => resolve('pending'), 30))])).toBe('file:///avatar.jpg');
});

test('annuler ferme sans ouvrir la galerie', async () => {
  const { result } = await renderHook(() => useSelfiePicker());
  let picked!: Promise<string | null>;
  await act(async () => { picked = result.current.pick(); });
  await act(async () => { (result.current.sheet as ReactElement<Callbacks>).props.onDismiss(); });
  await expect(picked).resolves.toBeNull();
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});

test('deux appuis partagent la même opération', async () => {
  const { result } = await renderHook(() => useSelfiePicker());
  let first!: Promise<string | null>;
  let second!: Promise<string | null>;
  await act(async () => { first = result.current.pick(); second = result.current.pick(); });
  expect(first).toBe(second);
  await act(async () => { (result.current.sheet as ReactElement<Callbacks>).props.onDismiss(); });
  await expect(first).resolves.toBeNull();
});
