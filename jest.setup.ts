/// <reference types="jest" />
// Les imports transitifs de lib/supabase lèvent sans variables d'environnement.
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'jest-anon-key';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })), addEventListener: jest.fn(() => () => {}) }));
jest.mock('expo-contacts', () => ({ Contact: { getAllDetails: jest.fn(async () => []) }, ContactField: { PHONES: 'phones' }, getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn() }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-pulsar', () => require('react-native-pulsar/jest-mock'));
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
// Toast allégé : le vrai provider garde un setTimeout qui survit au teardown Jest (crash « Animated undefined »).
// Le texte reste rendu dans un <Text> pour que les tests puissent l'affirmer.
jest.mock('./src/components/Toast', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Ctx = React.createContext(() => {});
  const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [msg, setMsg] = React.useState('');
    return React.createElement(Ctx.Provider, { value: setMsg }, children, msg ? React.createElement(Text, null, msg) : null);
  };
  return { ToastProvider, useToast: () => React.useContext(Ctx) };
});
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  // Le mock officiel v4 n'expose pas useReducedMotion (retiré vers worklets).
  if (typeof mock.useReducedMotion !== 'function') mock.useReducedMotion = () => false;
  return mock;
});
// @expo/ui est natif : MenuView affiche juste ses enfants en tests
jest.mock('@expo/ui/community/menu', () => ({ MenuView: ({ children }: { children?: unknown }) => children ?? null }));
// Skia est ESM + natif : chaque export devient un composant qui rend ses enfants,
// et l'objet Skia une chaîne appelable (Path.Make, Paint, RuntimeEffect.Make…)
jest.mock('@shopify/react-native-skia', () => {
  const chain: unknown = new Proxy(function () {}, { get: () => chain, apply: () => chain });
  const comp = (props: { children?: unknown } | null) => props?.children ?? null;
  return new Proxy(
    {},
    {
      get: (_t, name) => {
        if (name === 'vec') return (x: number, y: number) => ({ x, y });
        if (name === 'Skia') return chain;
        if (name === 'useClock') return () => ({ value: 0 });
        return comp;
      },
    },
  );
});
