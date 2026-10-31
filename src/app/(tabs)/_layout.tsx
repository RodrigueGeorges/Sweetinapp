import { setItems } from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ProfileError } from '../../components/ProfileError';
import { useToast } from '../../components/Toast';
import { t } from '../../i18n';
import { consumePendingInvite, useSession } from '../../lib/session';
import { useLanding } from '../../lib/returning';
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
  const { session, profile, profileReady, profileError, refreshProfile } = useSession();
  const toast = useToast();
  const landing = useLanding();
  // raccourci « nouvelle photo » au long-press sur l'icône d'accueil → /camera
  useQuickActionRouting();
  useEffect(() => {
    setItems([{ id: 'camera', title: t('inbox.shoot'), icon: 'camera', params: { href: '/camera' } }]).catch(() => {});
  }, []);
  // invitation ouverte avant la connexion : on ajoute l'ami maintenant
  useEffect(() => {
    if (profile?.onboarded) consumePendingInvite().then((name) => name && toast(t('invite.added', { name })));
  }, [profile?.onboarded, toast]);
  if (!session) return landing ? <Redirect href={landing} /> : null;
  // profil pas encore chargé : on attend plutôt que de flasher l'écran de setup
  if (!profileReady) return null;
  // lecture en échec ≠ profil absent : on propose de réessayer, pas de refaire son profil
  if (!profile) return profileError ? <ProfileError onRetry={() => { void refreshProfile(); }} /> : <Redirect href="/profile-setup" />;
  if (!profile.onboarded) return <Redirect href="/profile-setup" />;
  return (
    <Stack initialRouteName="inbox" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="inbox" options={{ animation: 'fade' }} />
      <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: colors.cacao } }} />
      <Stack.Screen name="contacts" options={{ animation: 'slide_from_left' }} />
    </Stack>
  );
}
