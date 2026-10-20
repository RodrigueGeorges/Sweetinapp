/// <reference types="jest" />

const mockInvoke = jest.fn();
const mockRpc = jest.fn();
const mockGetSession = jest.fn(async (): Promise<{ data: { session: { user: { id: string } } | null } }> => ({ data: { session: null } }));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getSession: () => mockGetSession() },
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
  },
}));

import NetInfo from '@react-native-community/netinfo';
import { addFriend, ApiError, avatarUrl, inviteUrl, isOnline, matchContacts, myId, openFlip, phoneSendError, sendFlip } from '../src/lib/api';

const edgeError = (status: number, body?: { code?: string; error?: string }) => ({
  context: { status, json: async () => body },
});

beforeEach(() => {
  mockInvoke.mockReset();
  mockRpc.mockReset();
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: null } });
});

describe('myId', () => {
  it('renvoie l’id de la session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await expect(myId()).resolves.toBe('u1');
  });

  it('lève NOT_AUTHENTICATED sans session', async () => {
    await expect(myId()).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
  });
});

describe('isOnline', () => {
  it('suit NetInfo', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
    await expect(isOnline()).resolves.toBe(false);
    (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: true, isInternetReachable: true });
    await expect(isOnline()).resolves.toBe(true);
  });
});

describe('call (via openFlip)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renvoie les données quand la fonction répond', async () => {
    mockInvoke.mockResolvedValue({ data: { id: 'f1', message: 'salut' }, error: null });
    await expect(openFlip('f1')).resolves.toMatchObject({ id: 'f1' });
    expect(mockInvoke).toHaveBeenCalledWith('open-flip', { body: { flip_id: 'f1' } });
  });

  it('ne réessaie pas une erreur métier (4xx)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: edgeError(422, { code: 'ALREADY_OPENED', error: 'déjà gratté' }) });
    await expect(openFlip('f1')).rejects.toMatchObject({ code: 'ALREADY_OPENED', retryable: false });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('réessaie une erreur serveur puis réussit', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: edgeError(500) }).mockResolvedValueOnce({ data: { id: 'f1' }, error: null });
    const p = openFlip('f1');
    await jest.advanceTimersByTimeAsync(900);
    await expect(p).resolves.toMatchObject({ id: 'f1' });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('abandonne après 4 tentatives sur erreur réseau', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: {} });
    const p = openFlip('f1');
    p.catch(() => {});
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(p).rejects.toBeInstanceOf(ApiError);
    expect(mockInvoke).toHaveBeenCalledTimes(4);
  });
});

describe('sendFlip', () => {
  it('refuse hors ligne sans rien envoyer', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
    await expect(sendFlip({ localUri: 'file:///cache/a.jpg', message: 'x', mode: 'free', recipients: [] })).rejects.toMatchObject({ code: 'OFFLINE' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('rpc', () => {
  it('addFriend traduit une erreur serveur en ApiError codée', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'USERNAME_NOT_FOUND' } });
    await expect(addFriend('@personne')).rejects.toMatchObject({ code: 'USERNAME_NOT_FOUND' });
    expect(mockRpc).toHaveBeenCalledWith('add_friend', { p_username: 'personne' });
  });

  it('matchContacts envoie les empreintes par paquets de 2000 et dédoublonne', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 'u9', username: 'lea', avatar_path: null }], error: null });
    const hashes = Array.from({ length: 4500 }, (_, i) => `h${i}`);
    const out = await matchContacts(hashes);
    expect(mockRpc).toHaveBeenCalledTimes(3);
    expect(mockRpc.mock.calls[0][1].p_hashes).toHaveLength(2000);
    expect(mockRpc.mock.calls[2][1].p_hashes).toHaveLength(500);
    expect(out).toHaveLength(1);
    expect(out[0].username).toBe('lea');
  });
});

describe('phoneSendError', () => {
  it('sms_send_failed (code machine) → PHONE_DISABLED', () => {
    const e = phoneSendError({ message: 'Error sending confirmation OTP to provider: Authentication Error', code: 'sms_send_failed' });
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('PHONE_DISABLED');
  });

  it('provider désactivé dans le message → PHONE_DISABLED', () => {
    expect(phoneSendError({ message: 'Unsupported phone provider' }).code).toBe('PHONE_DISABLED');
  });

  it('rate limit → RATE_LIMIT', () => {
    expect(phoneSendError({ message: 'too many requests', code: 'over_sms_send_rate_limit' }).code).toBe('RATE_LIMIT');
  });

  it('numéro invalide → PHONE_INVALID', () => {
    expect(phoneSendError({ message: 'Invalid phone number format', code: 'validation_failed' }).code).toBe('PHONE_INVALID');
  });
});

describe('url', () => {
  it('avatarUrl signe le chemin public ou renvoie null', () => {
    expect(avatarUrl('u1/a.jpg')).toBe('https://cdn.test/u1/a.jpg');
    expect(avatarUrl(null)).toBeNull();
  });

  it("inviteUrl encode le pseudo", () => {
    expect(inviteUrl('lé a')).toContain(encodeURIComponent('lé a'));
  });
});
