/// <reference types="jest" />
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: jest.fn(() => false), replace: jest.fn() }, useFocusEffect: jest.fn() }));

// le schéma du téléphone, piloté par le test
let mockScheme: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

import { StyleSheet, Text } from 'react-native';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';
import { Title } from '../src/components/ui';
import { darkColors, lightColors } from '../src/theme';

const render = (el: React.ReactElement): ReactTestRenderer => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el);
  });
  return r;
};

describe('thème', () => {
  afterEach(() => {
    mockScheme = 'light';
  });

  it('suit le mode clair du téléphone', () => {
    mockScheme = 'light';
    const r = render(<Title>bonjour</Title>);
    const text = r.root.findByType(Text);
    expect(StyleSheet.flatten(text.props.style)?.color).toBe(lightColors.ink);
  });

  it('suit le mode sombre du téléphone', () => {
    mockScheme = 'dark';
    const r = render(<Title>bonjour</Title>);
    const text = r.root.findByType(Text);
    expect(StyleSheet.flatten(text.props.style)?.color).toBe(darkColors.ink);
  });

  it('les deux palettes ont les mêmes clés et des fonds différents', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
    expect(darkColors.paper).not.toBe(lightColors.paper);
    expect(darkColors.cacao).toBe(lightColors.cacao); // couleurs de marque fixes
    expect(darkColors.vanille).toBe(lightColors.vanille);
  });
});
