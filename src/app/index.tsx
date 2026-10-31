import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ProfileError } from '../components/ProfileError';
import { draft } from '../lib/draft';
import { useSession } from '../lib/session';
import { useLanding } from '../lib/returning';

/** Aiguillage : bienvenue → profil à compléter → (premier sweet à envoyer) → vitrine. */
export default function Index() {
  const { session, profile, profileReady, profileError, refreshProfile } = useSession();
  const [pending, setPending] = useState<boolean | null>(draft.pending || null);
  const landing = useLanding();
  useEffect(() => {
    if (pending === null) draft.restore().then(setPending);
  }, [pending]);
  // déjà eu un compte sur ce téléphone : directement la connexion, pas l'accueil à gratter
  if (!session) return landing ? <Redirect href={landing} /> : null;
  if (!profileReady) return null;
  if (!profile) return profileError ? <ProfileError onRetry={() => { void refreshProfile(); }} /> : <Redirect href="/profile-setup" />;
  if (!profile.onboarded) return <Redirect href="/profile-setup" />;
  if (pending === null) return null;
  // brouillon remis à plus tard : l'inbox le propose, on ne force plus l'envoi
  if (pending && !draft.deferred) return <Redirect href="/sendto" />;
  return <Redirect href="/inbox" />;
}
