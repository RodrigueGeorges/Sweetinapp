import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Mark } from '../../components/Logo';
import { useToast } from '../../components/Toast';
import { Screen, Title } from '../../components/ui';
import { t, humanError } from '../../i18n';
import { acceptInvite, type InviteSource } from '../../lib/api';
import { track } from '../../lib/monitoring';
import { rememberInvite, useSession } from '../../lib/session';
import { colors } from '../../theme';

/**
 * Lien d'invitation https://sweetin.app/u/<pseudo> (ou sweetin://u/<pseudo>).
 * Connecté avec un profil complet : on ajoute l'ami tout de suite.
 * Sinon : on garde le pseudo, il sera ajouté à la fin de l'inscription.
 */
export default function InviteLink() {
  const { username, src } = useLocalSearchParams<{ username: string; src?: string }>();
  const source: InviteSource = (['link', 'flip', 'story', 'qr', 'contacts'] as const).find((x) => x === src) ?? 'link';
  const { session, profile } = useSession();
  const toast = useToast();
  const name = String(username ?? '').replace(/^@/, '').toLowerCase();

  useEffect(() => {
    if (!name) return void router.replace('/');
    if (!session || !profile?.onboarded) {
      rememberInvite(name, source).then(() => {
        toast(t('invite.later', { name }));
        router.replace('/');
      });
      return;
    }
    acceptInvite(name, source)
      .then((p) => {
        track('invite_accepted', { source });
        toast(t('invite.added', { name: p.username }));
      })
      .catch((e: Error) => toast(humanError(e)))
      .finally(() => router.replace('/contacts'));
  }, [name, source, session, profile?.onboarded, toast]);

  return (
    <Screen tone="cerise" style={s.center}>
      <Mark size={64} cone={colors.cacao} />
      <Title tone="cerise" size={34} style={{ textAlign: 'center' }}>
        {t('invite.adding', { name })}
      </Title>
      <ActivityIndicator color={colors.cacao} />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 32 },
});
