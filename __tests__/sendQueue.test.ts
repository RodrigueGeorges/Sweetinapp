import AsyncStorage from '@react-native-async-storage/async-storage';
import { flushSendQueue, pendingSends, queueSend } from '../src/lib/sendQueue';
import { ApiError, forgetLocalPhoto, sendFlip } from '../src/lib/api';

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
  return { ApiError, sendFlip: jest.fn(), forgetLocalPhoto: jest.fn() };
});

const send = { localUri: 'file:///cache/a.jpg', message: 'coucou', mode: 'free' as const, recipients: ['u1'], preview: null };
const mockedSend = sendFlip as jest.MockedFunction<typeof sendFlip>;
const mockedForget = forgetLocalPhoto as jest.MockedFunction<typeof forgetLocalPhoto>;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedSend.mockReset();
  mockedForget.mockReset();
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
  expect(await pendingSends()).toHaveLength(0);
  expect(mockedForget).toHaveBeenCalledWith(send.localUri);
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
  await AsyncStorage.setItem('sweetin.sendQueue', JSON.stringify([{ ...send, queued_at: Date.now() - 8 * 24 * 3600 * 1000 }]));
  expect(await flushSendQueue()).toBe(0);
  expect(await pendingSends()).toHaveLength(0);
  expect(mockedForget).toHaveBeenCalledWith(send.localUri);
});

test('file pleine : le plus vieux sort et sa photo est nettoyée', async () => {
  for (let i = 0; i < 6; i++) await queueSend({ ...send, localUri: `file:///cache/${i}.jpg` });
  const list = await pendingSends();
  expect(list).toHaveLength(5);
  expect(list[0].localUri).toBe('file:///cache/1.jpg');
  expect(mockedForget).toHaveBeenCalledWith('file:///cache/0.jpg');
});
