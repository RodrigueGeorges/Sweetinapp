import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Fondue } from '../components/Fondue';
import { Button, Screen, Title } from '../components/ui';
import { t } from '../i18n';
import { colors, tx } from '../theme';

/** Adresse inconnue : la page a fondu. */
export default function NotFound() {
  return (
    <Screen>
      <View style={s.center}>
        <Fondue mood="melt" size={110} />
        <Title style={s.title}>{t('notFound.title')}</Title>
        <Text style={s.body}>{t('notFound.body')}</Text>
        <Link href="/" asChild>
          <Button label={t('common.home')} tone="cerise" size="md" style={s.btn} />
        </Link>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { marginTop: 18, textAlign: 'center' },
  body: { ...tx.text, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: 10, marginBottom: 26 },
  btn: { minWidth: 200 },
});
