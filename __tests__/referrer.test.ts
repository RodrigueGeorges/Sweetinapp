/// <reference types="jest" />
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/lib/monitoring', () => ({ track: jest.fn() }));
jest.mock('../src/lib/session', () => ({ rememberInvite: jest.fn() }));
jest.mock('expo-application', () => ({ getInstallReferrerAsync: jest.fn() }));
import { parseReferrer } from '../src/lib/referrer';

describe('invitation gardée par le Play Store', () => {
  test('referrer décodé', () => expect(parseReferrer('invite=tom&src=flip')).toEqual({ name: 'tom', source: 'flip' }));
  test('referrer encore encodé', () => expect(parseReferrer('invite%3Dlea.m%26src%3Dqr')).toEqual({ name: 'lea.m', source: 'qr' }));
  test('source inconnue → link', () => expect(parseReferrer('invite=tom&src=zzz')).toEqual({ name: 'tom', source: 'link' }));
  test('referrer Play par défaut ou pseudo invalide → rien', () => {
    expect(parseReferrer('utm_source=google-play&utm_medium=organic')).toBeNull();
    expect(parseReferrer('invite=<script>')).toBeNull();
    expect(parseReferrer('')).toBeNull();
  });
});
