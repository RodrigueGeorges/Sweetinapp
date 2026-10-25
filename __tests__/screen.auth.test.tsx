/// <reference types="jest" />
/**
 * « Connexion / inscription » : validation email + mot de passe, signup → mail
 * de confirmation, login → accueil, mot de passe oublié, erreurs lisibles.
 * C'est la porte d'entrée du compte — chaque rejet doit rester gracieux.
 */

const mockSignUp = jest.fn();
const mockSignIn = jest.fn();
const mockOtp = jest.fn(async (_opts?: unknown): Promise<unknown> => ({ data: {}, error: null }));
const mockVerifyOtp = jest.fn(async (_opts?: unknown): Promise<unknown> => ({ data: { session: {} }, error: null }));
const mockResetPw = jest.fn(async (_mail: string, _opts?: unknown) => ({}));
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...a: unknown[]) => mockSignUp(...a),
      signInWithPassword: (...a: unknown[]) => mockSignIn(...a),
      signInWithOtp: (...a: unknown[]) => mockOtp(...a),
      verifyOtp: (...a: unknown[]) => mockVerifyOtp(...a),
      resetPasswordForEmail: (mail: string, opts?: unknown) => mockResetPw(mail, opts),
      getSession: jest.fn(),
    },
    functions: { invoke: jest.fn() },
    rpc: jest.fn(),
  },
}));

const mockSignInApple = jest.fn(async () => {});
const mockSignInGoogle = jest.fn(async () => true);
jest.mock('../src/lib/api', () => ({
  ...jest.requireActual('../src/lib/api'),
  signInWithApple: () => mockSignInApple(),
  signInWithGoogle: () => mockSignInGoogle(),
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_UP: 1, CONTINUE: 2 },
  AppleAuthenticationButtonStyle: { BLACK: 1 },
}));
jest.mock('expo-linking', () => ({ createURL: (p: string) => `sweetin://${p}`, openURL: jest.fn() }));
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn() , setTestGroup: jest.fn() }));

let mockParams: { mode?: string; next?: string; mail?: string } = { mode: 'login' };
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: (...a: unknown[]) => mockReplace(...a), setParams: (...a: unknown[]) => mockSetParams(...a), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 1, Medium: 2, Heavy: 3 },
  NotificationFeedbackType: { Success: 1, Warning: 2, Error: 3 },
}));
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

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Auth from '../src/app/auth';
import { ToastProvider } from '../src/components/Toast';
import { t } from '../src/i18n';

const renderAuth = () =>
  render(
    <ToastProvider>
      <Auth />
    </ToastProvider>,
  );

/** Le SMS est la voie par défaut : les tests email basculent d'abord sur le formulaire email. */
const switchToEmail = async (r: { findByText: (q: string) => Promise<unknown> }) => fireEvent.press((await r.findByText(t('auth.useEmail'))) as never);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { mode: 'login' };
});

describe('auth · téléphone (voie par défaut)', () => {
  it('le champ téléphone est affiché en premier, le CTA exige un numéro valide', async () => {
    const r = await renderAuth();
    const cta = await r.findByLabelText(t('phone.send'));
    expect(cta.props.accessibilityState?.disabled).toBe(true);
    fireEvent.changeText(await r.findByLabelText(t('phone.number')), '+33612345678');
    const cta2 = await r.findByLabelText(t('phone.send'));
    expect(cta2.props.accessibilityState?.disabled).toBe(false);
  });

  it('numéro valide → code envoyé, champ code affiché', async () => {
    const r = await renderAuth();
    fireEvent.changeText(await r.findByLabelText(t('phone.number')), '+33612345678');
    fireEvent.press(await r.findByText(t('phone.send')));
    await waitFor(() => expect(mockOtp).toHaveBeenCalledWith({ phone: '+33612345678' }));
    expect(await r.findByLabelText(t('phone.code'))).toBeTruthy();
  });

  it('6 chiffres saisis → verifyOtp → accueil', async () => {
    const r = await renderAuth();
    fireEvent.changeText(await r.findByLabelText(t('phone.number')), '+33612345678');
    fireEvent.press(await r.findByText(t('phone.send')));
    fireEvent.changeText(await r.findByLabelText(t('phone.code')), '123456');
    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledWith({ phone: '+33612345678', token: '123456', type: 'sms' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('code faux → message clair, on reste sur place', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ data: {}, error: new Error('Token has expired or is invalid') });
    const r = await renderAuth();
    fireEvent.changeText(await r.findByLabelText(t('phone.number')), '+33612345678');
    fireEvent.press(await r.findByText(t('phone.send')));
    fireEvent.changeText(await r.findByLabelText(t('phone.code')), '000000');
    await waitFor(() => expect(r.queryAllByText(t('auth.badCode')).length).toBeGreaterThan(0));
    expect(mockReplace).not.toHaveBeenCalledWith('/');
  });
});

describe('auth · validation', () => {
  it('le CTA exige un email valide et 8 caractères', async () => {
    const r = await renderAuth();
    await switchToEmail(r);
    const { findByLabelText } = r;
    const cta = await findByLabelText(t('auth.validate'));
    // CTA désactivé tant que le formulaire n'est pas prêt
    expect(cta.props.accessibilityState?.disabled).toBe(true);
    fireEvent.changeText(await findByLabelText(t('auth.email')), 'moi@test.fr');
    const cta2 = await findByLabelText(t('auth.validate'));
    expect(cta2.props.accessibilityState?.disabled).toBe(true); // mot de passe encore vide
    fireEvent.changeText(await findByLabelText(t('auth.password')), 'motdepasse123');
    const cta3 = await findByLabelText(t('auth.validate'));
    expect(cta3.props.accessibilityState?.disabled).toBe(false);
  });

  it('email invalide → message clair, pas d’appel réseau', async () => {
    const r = await renderAuth();
    await switchToEmail(r);
    const { findByLabelText, findByText } = r;
    fireEvent.changeText(await findByLabelText(t('auth.email')), 'pasunmail');
    fireEvent.changeText(await findByLabelText(t('auth.password')), 'motdepassetreslong');
    // le CTA est désactivé : la validation part via « entrée » du clavier
    fireEvent(await findByLabelText(t('auth.password')), 'submitEditing');
    expect(await findByText(t('auth.badEmail'))).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});

describe('auth · login', () => {
  it('email + mot de passe valides → signInWithPassword → accueil', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: null });
    const r = await renderAuth();
    await switchToEmail(r);
    const { findByLabelText, findByText } = r;
    fireEvent.changeText(await findByLabelText(t('auth.email')), 'moi@test.fr');
    fireEvent.changeText(await findByLabelText(t('auth.password')), 'motdepasse123');
    fireEvent.press(await findByText(t('auth.validate')));
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'moi@test.fr', password: 'motdepasse123' });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('mauvais identifiants → message « wrong », on reste sur place', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: new Error('Invalid login credentials') });
    const r = await renderAuth();
    await switchToEmail(r);
    const { findByLabelText, findByText } = r;
    fireEvent.changeText(await findByLabelText(t('auth.email')), 'moi@test.fr');
    fireEvent.changeText(await findByLabelText(t('auth.password')), 'motdepasse123');
    fireEvent.press(await findByText(t('auth.validate')));
    await waitFor(() => expect(r.queryAllByText(t('auth.wrong')).length).toBeGreaterThan(0));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('mauvais mot de passe → erreur inline sous le champ, effacée à la frappe', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: new Error('Invalid login credentials') });
    const r = await renderAuth();
    await switchToEmail(r);
    const { findByLabelText, findByText } = r;
    fireEvent.changeText(await findByLabelText(t('auth.email')), 'moi@test.fr');
    fireEvent.changeText(await findByLabelText(t('auth.password')), 'motdepasse123');
    fireEvent.press(await findByText(t('auth.validate')));
    // le toast porte le même texte : l'erreur inline se reconnaît à sa liveRegion
    await waitFor(() => expect(r.queryAllByText(t('auth.wrong')).some((n) => n.props.accessibilityLiveRegion === 'polite')).toBe(true));
    fireEvent.changeText(await findByLabelText(t('auth.password')), 'x');
    await waitFor(() => expect(r.queryAllByText(t('auth.wrong')).some((n) => n.props.accessibilityLiveRegion === 'polite')).toBe(false));
  });

  it('mot de passe oublié → lien de réinitialisation envoyé', async () => {
    const r = await renderAuth();
    await switchToEmail(r);
    const { findByLabelText, findByText } = r;
    fireEvent.changeText(await findByLabelText(t('auth.email')), 'moi@test.fr');
    fireEvent.press(await findByText(t('auth.forgot')));
    expect(mockResetPw).toHaveBeenCalledWith('moi@test.fr', expect.objectContaining({ redirectTo: expect.stringContaining('auth-callback') }));
  });
});

describe('auth · signup', () => {
  it('signup sans session immédiate → écran « check your email »', async () => {
    mockParams = { mode: 'signup', next: 'send' };
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    const r = await renderAuth();
    const { findByText, findByLabelText } = r;
    expect(await findByText(t('auth.titleSend'))).toBeTruthy();
    await switchToEmail(r);
    fireEvent.changeText(await findByLabelText(t('auth.email')), 'nouveau@test.fr');
    fireEvent.changeText(await findByLabelText(t('auth.password')), 'motdepasse123');
    fireEvent.press(await findByText(t('auth.validate')));
    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'nouveau@test.fr' }));
    expect(await findByText(t('auth.sent'))).toBeTruthy();
  });
});
