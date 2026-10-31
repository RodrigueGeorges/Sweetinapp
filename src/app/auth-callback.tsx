import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useToast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { Screen } from '../components/ui';
import { t } from '../i18n';
import { supabase } from '../lib/supabase';

/** Retour du lien reçu par email (confirmation ou mot de passe oublié). */
export default function AuthCallback() {
  const { code, flow } = useLocalSearchParams<{ code?: string; flow?: string }>();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        if (!code) throw new Error('missing code');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (flow === 'recovery') return router.replace('/auth?mode=reset');
        toast(t('auth.welcome'));
        router.replace('/');
      } catch {
        toast(t('auth.linkExpired'));
        router.replace('/auth?mode=login');
      }
    })();
  }, [code, flow, toast]);

  return (
    <Screen tone="cerise" style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <Loader size={64} />
    </Screen>
  );
}
