import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { acceptInvite, getMyProfile, type InviteSource, type MyProfile } from './api';
import { identify, track } from './monitoring';
import { watchLiveTokens } from './live';
import { registerForPush } from './push';
import { markHasAccount } from './returning';
import { loadConfig } from './config';
import { supabase } from './supabase';
import { draft } from './draft';

const PENDING_INVITE = 'sweetin.pendingInvite';

type Ctx = {
  session: Session | null;
  profile: MyProfile | null;
  /** Session et profil chargés (le profil peut être null si déconnecté). */
  ready: boolean;
  /** Le profil de la session courante a été récupéré au moins une fois (succès ou échec). */
  profileReady: boolean;
  /** La dernière lecture du profil a échoué : à distinguer de « profil absent » pour ne pas renvoyer vers le setup. */
  profileError: boolean;
  refreshProfile: () => Promise<MyProfile | null>;
};
const SessionContext = createContext<Ctx>({ session: null, profile: null, ready: false, profileReady: false, profileError: false, refreshProfile: async () => null });

/** Garde un pseudo d'invitation à traiter quand l'utilisateur aura un profil complet. */
export const rememberInvite = (username: string, source: InviteSource = 'link') => AsyncStorage.setItem(PENDING_INVITE, `${username}|${source}`).catch(() => {});

/** Pseudo de l'invitation en attente, sans la consommer (accueil personnalisé). */
export async function peekPendingInvite(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(PENDING_INVITE).catch(() => null);
  const name = raw?.split('|')[0] ?? '';
  return /^[a-z0-9._]{3,20}$/i.test(name) ? name : null;
}

/** Ajoute l'ami de l'invitation en attente, s'il y en a une. Renvoie son pseudo. */
export async function consumePendingInvite(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(PENDING_INVITE).catch(() => null);
  if (!raw) return null;
  const [name, source] = raw.split('|') as [string, InviteSource | undefined];
  await AsyncStorage.removeItem(PENDING_INVITE).catch(() => {});
  try {
    const p = await acceptInvite(name, source ?? 'link');
    track('invite_accepted', { source: source ?? 'link' });
    return p.username;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState(false);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await getMyProfile();
      setProfile(p);
      setProfileError(false);
      return p;
    } catch {
      setProfileError(true);
      return null;
    } finally {
      setProfileReady(true);
    }
  }, []);

  useEffect(() => {
    loadConfig(); // réglages à distance (durée de lecture…), sans bloquer le démarrage
    supabase.auth.getSession().then(async ({ data }) => {
      draft.setOwner(data.session?.user.id ?? null);
      setSession(data.session);
      if (data.session) markHasAccount();
      if (data.session) await refreshProfile();
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      draft.setOwner(s?.user.id ?? null);
      setSession(s);
      if (s) {
        markHasAccount();
        // nouveau compte : on attend son profil avant d'aiguiller vers le setup
        setProfileReady(false);
        refreshProfile();
      } else {
        setProfile(null);
        setProfileReady(false);
        setProfileError(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refreshProfile]);

  useEffect(() => {
    identify(session?.user.id ?? null);
    if (!session?.user.id) return;
    registerForPush(session.user.id).catch(() => {});
    return watchLiveTokens(session.user.id);
  }, [session?.user.id]);

  return <SessionContext.Provider value={{ session, profile, ready, profileReady, profileError, refreshProfile }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
