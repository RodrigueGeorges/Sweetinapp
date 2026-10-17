import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useToast } from '../components/Toast';
import { Body, BottomCTA, Button, Field, Header, Screen, Title } from '../components/ui';
import { t } from '../i18n';
import { requestPhoneCode, verifyPhoneCode } from '../lib/api';
import { toE164 } from '../lib/contacts';
import { track } from '../lib/monitoring';
import { colors, tx } from '../theme';

/** Ajout du numéro (vérifié par SMS) pour être retrouvé par ses amis. */
export default function Phone() {
  const toast = useToast();
  const [raw, setRaw] = useState('');
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<TextInput>(null);

  // le renvoi a un tempo : un SMS toutes les 30 s maximum
  useEffect(() => {
    if (cooldown <= 0) return;
    const iv = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(iv);
  }, [cooldown]);

  const send = async () => {
    const n = toE164(raw);
    if (!n) return toast(t('err.PHONE_INVALID'));
    setBusy(true);
    try {
      await requestPhoneCode(n);
      setE164(n);
      setCode('');
      setCooldown(30);
      setTimeout(() => codeRef.current?.focus(), 200);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = useCallback(async () => {
    if (!e164 || code.length < 4 || busy) return;
    setBusy(true);
    try {
      await verifyPhoneCode(e164, code);
      track('phone_verified');
      toast(t('phone.done'));
      if (router.canGoBack()) router.back();
      else router.replace('/friends-setup');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [e164, code, busy, toast]);

  // 6 chiffres tapés : on vérifie sans attendre le bouton (une seule tentative par saisie)
  const tried = useRef(false);
  useEffect(() => {
    if (code.length < 6) {
      tried.current = false;
      return;
    }
    if (!tried.current && e164 && !busy) {
      tried.current = true;
      verify();
    }
  }, [code, e164, busy, verify]);

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Header back />
        <View style={s.form}>
          <Title size={48}>{t('phone.title')}</Title>
          <Body>{t('phone.sub')}</Body>
          <Field
            label={t('phone.number')}
            value={raw}
            onChangeText={(v) => {
              setRaw(v);
              setE164(null);
            }}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoFocus
            placeholder={t('phone.placeholder')}
          />
          {e164 ? (
            <View style={{ gap: 10 }}>
              <Field
                ref={codeRef}
                label={t('phone.code')}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                style={s.code}
                onSubmitEditing={verify}
              />
              <Pressable onPress={send} hitSlop={8} accessibilityRole="button" disabled={cooldown > 0 || busy}>
                <Text style={[s.resend, (cooldown > 0 || busy) && { color: colors.muted, textDecorationLine: 'none' }]}>{cooldown > 0 ? t('phone.resendIn', { n: cooldown }) : t('phone.resend')}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <BottomCTA>
          <Button label={e164 ? t('phone.verify') : t('phone.send')} arrow loading={busy} onPress={e164 ? verify : send} />
        </BottomCTA>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  form: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  code: { letterSpacing: 10, textAlign: 'center', ...tx.black, fontSize: 22 },
  resend: { ...tx.bold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
});
