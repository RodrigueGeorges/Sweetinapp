import AsyncStorage from '@react-native-async-storage/async-storage';
import { flushSendQueue, pendingSends, queueSend } from '../src/lib/sendQueue';
import { ApiError, forgetLocalPhoto, sendFlip, myId } from '../src/lib/api';

jest.mock('expo-crypto', () => ({ randomUUID: () => `send-${Math.random()}` }));

jest.mock('../src/lib/api', () => {
  class ApiError extends Error {
    code: string | undefined;
    retryable: boolean;
    constructor(code: string | undefined, message?: string, retryable = false) {
      super(message ?? code ?? 'error');
      this.code = code;
      this.retryable = retryable;
    }
  }
  return { ApiError, sendFlip: jest.fn(), forgetLocalPhoto: jest.fn(), myId: jest.fn(async () => 'u1') };
});

const send = { localUri: 'file:///cache/a.jpg', message: 'coucou', mode: 'free' as const, recipients: ['u1'], preview: null };
const mockedSend = sendFlip as jest.MockedFunction<typeof sendFlip>;
const mockedForget = forgetLocalPhoto as jest.MockedFunction<typeof forgetLocalPhoto>;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedSend.mockReset();
  mockedForget.mockReset();
  (myId as jest.Mock).mockResolvedValue('u1');
});

test('un sweet hors connexion attend dans la file', async () => {
  await queueSend(send);
  expect(await pendingSends()).toHaveLength(1);
  expect((await pendingSends())[0]).toMatchObject({ localUri: send.localUri, recipients: ['u1'] });
});

test('au retour du réseau le sweet part et la file se vide', async () => {
  await queueSend(send);
  mockedSend.mockResolvedValue({ id: 'f1', sent_to: 1, sweet_hour: false, link_url: null, link: null, streak: 0 });
  expect(await flushSendQueue()).toBe(1);
  expect(mockedSend).toHaveBeenCalledWith(expect.objectContaining({ localUri: send.localUri, message: 'coucou' }));
  expect(await pendingSends()).toHaveLength(0);
});

test('toujours hors ligne : le sweet reste en file', async () => {
  await queueSend(send);
  mockedSend.mockRejectedValue(new ApiError('OFFLINE', undefined, true));
  expect(await flushSendQueue()).toBe(0);
  expect(await pendingSends()).toHaveLength(1);
});

test('un refus définitif ne retente pas indéfiniment', async () => {
  await queueSend(send);
  mockedSend.mockRejectedValue(new ApiError('MESSAGE_REFUSED', undefined, false));
  expect(await flushSendQueue()).toBe(0);
  expect((await pendingSends())[0].failure).toBeDefined();
  expect(mockedForget).not.toHaveBeenCalled();
});

test('une panne serveur garde le sweet et continue la file', async () => {
  await queueSend(send);
  await queueSend({ ...send, localUri: 'file:///cache/b.jpg' });
  mockedSend.mockRejectedValueOnce(new ApiError('UPLOAD', undefined, true)).mockResolvedValue({ id: 'f2', sent_to: 1, sweet_hour: false, link_url: null, link: null, streak: 0 });
  expect(await flushSendQueue()).toBe(1);
  expect(await pendingSends()).toHaveLength(1);
  expect((await pendingSends())[0].localUri).toBe(send.localUri);
});

test('un sweet trop vieux est abandonné', async () => {
  await AsyncStorage.setItem('sweetin.sendQueue.v2:u1', JSON.stringify([{ ...send, ownerId: 'u1', sendId: 'expired', queued_at: Date.now() - 8 * 24 * 3600 * 1000 }]));
  expect(await flushSendQueue()).toBe(0);
  expect((await pendingSends())[0].failure).toBeDefined();
  expect(mockedForget).not.toHaveBeenCalled();
});

test('file pleine : refuse sans perdre le plus ancien', async () => {
  for (let i = 0; i < 5; i++) await queueSend({ ...send, localUri: `file:///cache/${i}.jpg` });
  await expect(queueSend(send)).rejects.toMatchObject({ code: 'QUEUE_FULL' });
  expect((await pendingSends())[0].localUri).toBe('file:///cache/0.jpg');
  expect(mockedForget).not.toHaveBeenCalled();
});

test('un ajout pendant la synchronisation reste en attente', async () => {
  await queueSend(send);
  let finish!: (value: Awaited<ReturnType<typeof sendFlip>>) => void;
  let start!: () => void;
  const started = new Promise<void>((resolve) => { start = resolve; });
  mockedSend.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; start(); }));
  const work = flushSendQueue();
  await started;
  await queueSend({ ...send, localUri: 'file:///cache/b.jpg' });
  finish({ id: 'f1', sent_to: 1, sweet_hour: false, link_url: null, link: null, streak: 0 });
  await work;
  expect((await pendingSends()).map((q) => q.localUri)).toEqual(['file:///cache/b.jpg']);
});

test('un échec de stockage est signalé', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage full'));
  await expect(queueSend(send)).rejects.toThrow('storage full');
});

test('changer de compte ne charge et ne transmet pas les envois précédents', async () => {
  await queueSend(send);
  (myId as jest.Mock).mockResolvedValue('u2');
  expect(await pendingSends()).toEqual([]);
  expect(await flushSendQueue()).toBe(0);
  expect(mockedSend).not.toHaveBeenCalled();
  (myId as jest.Mock).mockResolvedValue('u1');
  expect(await pendingSends()).toHaveLength(1);
});
