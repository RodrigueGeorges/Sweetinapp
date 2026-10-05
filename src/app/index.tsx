import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { draft } from '../lib/draft';
import { useSession } from '../lib/session';

/** Aiguillage : bienvenue → profil à compléter → (premier secret à envoyer) → appareil photo. */
export default function Index() {
  const { session, profile } = useSession();
  const [pending, setPending] = useState<boolean | null>(draft.pending || null);
  useEffect(() => {
    if (pending === null) draft.restore().then(setPending);
  }, [pending]);
  if (!session) return <Redirect href="/welcome" />;
  if (!profile?.onboarded) return <Redirect href="/profile-setup" />;
  if (pending === null) return null;
  if (pending) return <Redirect href="/sendto" />;
  return <Redirect href="/camera" />;
}
