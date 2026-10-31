import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Mark } from '../../components/Logo';
import { Screen, Title } from '../../components/ui';
import { t } from '../../i18n';
import { colors } from '../../theme';

const LINK_DOMAIN = process.env.APP_LINK_DOMAIN ?? 'sweetinapp.netlify.app';

/**
 * Lien privé https://sweetinapp.netlify.app/f/<jeton> (ou sweetin://f/<jeton>).
 * Le grattage se fait sur la page web (« works without the app ») : on y renvoie
 * au lieu de tomber sur l'écran introuvable quand l'OS livre le lien à l'app.
 */
export default function FlipLink() {
  const { token } = useLocalSearchParams<{ token: string }>();

  useEffect(() => {
    const t0 = String(token ?? '');
    if (!t0) return void router.replace('/');
    Linking.openURL(`https://${LINK_DOMAIN}/f/${encodeURIComponent(t0)}`).catch(() => {});
    router.replace('/');
  }, [token]);

  return (
    <Screen tone="cerise" style={s.center}>
      <Mark size={64} cone={colors.cacao} />
      <Title tone="cerise" size={34} style={{ textAlign: 'center' }}>
        {t('flip.opening')}
      </Title>
      <ActivityIndicator color={colors.cacao} />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 32 },
});
