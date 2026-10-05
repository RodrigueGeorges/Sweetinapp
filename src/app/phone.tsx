import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useToast } from '../components/Toast';
import { Body, BottomCTA, Button, Field, Header, Screen, Title } from '../components/ui';
import { t } from '../i18n';
import { requestPhoneCode, verifyPhoneCode } from '../lib/api';
import { toE164 } from '../lib/contacts';
import { track } from '../lib/monitoring';
import { tx, useStyles, type Palette } from '../theme';

/** Ajout du numéro (vérifié par SMS) pour être retrouvé par ses amis. */
export default function Phone() {
  const s = useStyles(themed);
  const toast = useToast();
  const [raw, setRaw] = useState('');
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<TextInput>(null);

  const send = async () => {
    const n = toE164(raw);
    if (!n) return toast(t('err.PHONE_INVALID'));
    setBusy(true);
    try {
      await requestPhoneCode(n);
      setE164(n);
      setTimeout(() => codeRef.current?.focus(), 200);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!e164 || code.length < 4) return;
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
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              <Pressable onPress={send} hitSlop={8} accessibilityRole="button">
                <Text style={s.resend}>{t('phone.resend')}</Text>
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

const themed = (colors: Palette) =>
  StyleSheet.create({
    form: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
    code: { letterSpacing: 10, textAlign: 'center', ...tx.black, fontSize: 22 },
    resend: { ...tx.bold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  });
