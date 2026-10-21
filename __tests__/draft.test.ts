/// <reference types="jest" />

const mockStore = new Map<string, string>();
jest.mock('../src/lib/kv', () => ({
  __esModule: true,
  kv: {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
    removeItem: jest.fn(async (k: string) => void mockStore.delete(k)),
  },
}));

import { kv } from '../src/lib/kv';
import { draft } from '../src/lib/draft';

const mocked = jest.mocked(kv);

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  draft.reset();
});

describe('draft', () => {
  it('setPhoto pose la photo et vide le mot', () => {
    draft.setMessage('ancien mot', false);
    draft.setPhoto('file:///cache/p.jpg');
    expect(draft.uri).toBe('file:///cache/p.jpg');
    expect(draft.message).toBe('');
    expect(draft.pending).toBe(false);
  });

  it('setMessage fixe le mode : once ou free', () => {
    draft.setMessage('coucou', true);
    expect(draft.mode).toBe('once');
    draft.setMessage('coucou', false);
    expect(draft.mode).toBe('free');
  });

  it('pending vrai quand photo + mot sont prêts', () => {
    draft.setPhoto('file:///cache/p.jpg');
    draft.setMessage('un mot', false);
    expect(draft.pending).toBe(true);
  });

  it('setReply prépare le destinataire de la réponse', () => {
    draft.setReply('u9', 'lea');
    expect(draft.replyTo).toBe('u9');
    expect(draft.replyName).toBe('lea');
  });

  it('reset vide tout, y compris la réponse et le brouillon gardé', () => {
    draft.setPhoto('file:///cache/p.jpg');
    draft.setMessage('un mot', true);
    draft.setReply('u9', 'lea');
    draft.reset();
    expect(draft.uri).toBe('');
    expect(draft.replyTo).toBeNull();
    expect(mocked.removeItem).toHaveBeenCalledWith('sweetin.guestDraft');
  });

  it('save puis restore retrouve le brouillon d’invité', async () => {
    draft.setPhoto('file:///cache/p.jpg');
    draft.setMessage('mot gardé', true);
    await draft.save();

    draft.uri = '';
    draft.message = '';
    draft.mode = 'free';
    await expect(draft.restore()).resolves.toBe(true);
    expect(draft.message).toBe('mot gardé');
    expect(draft.mode).toBe('once');
  });

  it('defer garde le brouillon mais arrête de forcer l’envoi ; reset annule le report', async () => {
    draft.setPhoto('file:///cache/p.jpg');
    draft.setMessage('un mot', false);
    expect(draft.mustSend).toBe(true);
    draft.defer();
    expect(draft.pending).toBe(true);
    expect(draft.mustSend).toBe(false);
    draft.reset();
    expect(draft.deferred).toBe(false);
  });

  it('defer survit à la sauvegarde/restauration du brouillon', async () => {
    draft.setPhoto('file:///cache/p.jpg');
    draft.setMessage('mot gardé', false);
    draft.defer();
    await draft.save();

    draft.uri = '';
    draft.message = '';
    draft.deferred = false;
    await expect(draft.restore()).resolves.toBe(true);
    expect(draft.pending).toBe(true);
    expect(draft.mustSend).toBe(false);
  });

  it('une nouvelle photo annule le report : l’envoi redevient proposé', () => {
    draft.setPhoto('file:///cache/p.jpg');
    draft.setMessage('un mot', false);
    draft.defer();
    draft.setPhoto('file:///cache/q.jpg');
    expect(draft.deferred).toBe(false);
  });

  it('restore renvoie false sans brouillon, et ne touche pas un brouillon déjà prêt', async () => {
    await expect(draft.restore()).resolves.toBe(false);
    draft.setPhoto('file:///cache/p.jpg');
    draft.setMessage('mot', false);
    await expect(draft.restore()).resolves.toBe(true);
    expect(draft.message).toBe('mot');
  });
});
