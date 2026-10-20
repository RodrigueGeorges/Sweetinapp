import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
// suit le clavier image par image (Android compris), au lieu du saut de KeyboardAvoidingView
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { NativeMenu } from '../components/NativeMenu';
import { useToast } from '../components/Toast';
import { Body, BottomCTA, Button, Field, Header, Screen, Title } from '../components/ui';
import { humanError, t } from '../i18n';
import { requestPhoneCode, verifyPhoneCode } from '../lib/api';
import { deviceCountry, PHONE_COUNTRIES as COUNTRIES, toE164 } from '../lib/contacts';
import type { CountryCode } from 'libphonenumber-js';
import { track } from '../lib/monitoring';
import { colors, tx } from '../theme';

/** Ajout du numéro (vérifié par SMS) pour être retrouvé par ses amis. */
export default function Phone() {
  const toast = useToast();
  const [raw, setRaw] = useState('');
  const [country, setCountry] = useState<CountryCode>(() => (COUNTRIES.some((x) => x.c === deviceCountry()) ? deviceCountry() : 'FR'));
  const cur = COUNTRIES.find((x) => x.c === country) ?? COUNTRIES[0];
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<TextInput>(null);

  const send = async () => {
    const n = toE164(raw, country); // un numéro tapé avec + garde son propre indicatif
    if (!n) return toast(t('err.PHONE_INVALID'));
    setBusy(true);
    try {
      await requestPhoneCode(n);
      setE164(n);
      setTimeout(() => codeRef.current?.focus(), 200);
    } catch (e) {
      toast(humanError(e));
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
      toast(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Header back />
        <View style={s.form}>
          <Title size={48}>{t('phone.title')}</Title>
          <Body>{t('phone.sub')}</Body>
          <NativeMenu title={t('phone.country')} items={COUNTRIES.map((x) => ({ id: x.c, title: `${x.flag}  ${x.dial}` }))} onSelect={(id) => { setCountry(id as CountryCode); setE164(null); }} label={t('phone.country')}>
            <View style={s.country}>
              <Text style={s.countryT}>{cur.flag}  {cur.dial}</Text>
              <Text style={s.countryChange}>{t('phone.countryChange')}</Text>
            </View>
          </NativeMenu>
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
            placeholder={country === 'FR' ? t('phone.placeholder') : t('phone.placeholderOther')}
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

const s = StyleSheet.create({
  form: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  code: { letterSpacing: 10, textAlign: 'center', ...tx.black, fontSize: 22 },
  resend: { ...tx.bold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  country: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, alignSelf: 'flex-start' },
  countryT: { ...tx.black, fontSize: 17, color: colors.ink },
  countryChange: { ...tx.bold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
});
