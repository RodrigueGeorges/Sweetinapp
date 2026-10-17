import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useToast } from '../../components/Toast';
import { t } from '../../i18n';
import { consumePendingInvite, useSession } from '../../lib/session';
import { colors } from '../../theme';

/**
 * Navigation façon BeReal (DA Fondant) : pas de barre d'onglets.
 * La vitrine est l'accueil ; le déclencheur en bas ouvre l'appareil photo en plein écran,
 * les amis s'ouvrent depuis le bouton en verre en haut à gauche, le profil depuis l'avatar en haut à droite.
 * Le dossier garde son nom `(tabs)` pour ne casser aucun lien (/inbox, /camera, /contacts).
 * La vitrine reste toujours dessous, même quand l'appareil photo ou les amis s'ouvrent par un lien ou une notification.
 */
export const unstable_settings = { initialRouteName: 'inbox' };

export default function HomeLayout() {
  const { session, profile } = useSession();
  const toast = useToast();
  // invitation ouverte avant la connexion : on ajoute l'ami maintenant
  useEffect(() => {
    if (profile?.onboarded) consumePendingInvite().then((name) => name && toast(t('invite.added', { name })));
  }, [profile?.onboarded, toast]);
  if (!session) return <Redirect href="/welcome" />;
  if (!profile?.onboarded) return <Redirect href="/profile-setup" />;
  return (
    <Stack initialRouteName="inbox" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="inbox" options={{ animation: 'fade' }} />
      <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: colors.cacao } }} />
      <Stack.Screen name="contacts" options={{ animation: 'slide_from_left' }} />
    </Stack>
  );
}
