import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { useToast } from '../components/Toast';
import { Mark } from '../components/Logo';
import { Screen } from '../components/ui';
import { t } from '../i18n';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

/** Retour du lien reçu par email (confirmation ou mot de passe oublié). */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) toast(t('auth.linkExpired'));
        else toast(t('auth.welcome'));
      }
      router.replace('/');
    })();
  }, [code, toast]);

  return (
    <Screen tone="cerise" style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <Mark size={64} />
      <ActivityIndicator color={colors.white} />
    </Screen>
  );
}
