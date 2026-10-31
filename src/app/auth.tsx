import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { Fondue } from '../components/Fondue';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
// suit le clavier image par image (Android compris), au lieu du saut de KeyboardAvoidingView
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Svg, { Path } from 'react-native-svg';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { NativeMenu } from '../components/NativeMenu';
import { Sticker } from '../components/Reactions';
import Animated, { ZoomIn } from 'react-native-reanimated';
import type { CountryCode } from 'libphonenumber-js';
import { Body, BottomCTA, Button, Field, Header, Screen, TextLink, Title } from '../components/ui';
import { deviceCountry, PHONE_COUNTRIES, toE164 } from '../lib/contacts';
import { legal } from '../lib/legal';
import { t, humanError } from '../i18n';
import { phoneSendError, signInWithApple, signInWithGoogle } from '../lib/api';
import { track } from '../lib/monitoring';
import { supabase } from '../lib/supabase';
import { colors, tx } from '../theme';

/**
 * Connexion ou inscription : le SMS est la voie royale — un code reçu en quelques
 * secondes, ni mot de passe ni aller-retour dans la boîte mail (et le numéro sert
 * direct au matching des contacts). Apple et Google restent, l'email en repli.
 * Le pseudo et la date de naissance sont demandés juste après, sur /profile-setup.
 */
export default function Auth() {
  const { mode, next } = useLocalSearchParams<{ mode?: string; next?: string }>();
  const signup = mode === 'signup';
  // arrivé ici depuis un premier secret écrit sans compte
  const sending = next === 'send';
  const toast = useToast();
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pwError, setPwError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [appleOk, setAppleOk] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<CountryCode>(() => (PHONE_COUNTRIES.some((x) => x.c === deviceCountry()) ? deviceCountry() : 'FR'));
  const cur = PHONE_COUNTRIES.find((x) => x.c === country) ?? PHONE_COUNTRIES[0];
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<TextInput>(null);
  const mailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const ready = mailOk && password.length >= 8;

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleOk).catch(() => {});
  }, []);

  const done = (m: string) => {
    track(signup ? 'auth_completed' : 'login', { method: m });
    router.replace('/');
  };

  // le renvoi a un tempo : un SMS toutes les 30 s maximum
  useEffect(() => {
    if (cooldown <= 0) return;
    const iv = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(iv);
  }, [cooldown]);

  /** Code par SMS : inscription et connexion au même endroit (Supabase crée le compte si besoin). */
  const sendCode = async () => {
    if (busy || cooldown > 0) return;
    const n = toE164(phone, country); // un numéro tapé avec + garde son propre indicatif
    if (!n) return toast(t('auth.badPhone'));
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: n });
      if (error) throw phoneSendError(error);
      setE164(n);
      setCode('');
      setCooldown(30);
      setTimeout(() => codeRef.current?.focus(), 200);
    } catch (e) {
      toast(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = useCallback(async () => {
    if (!e164 || code.length < 6 || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
      if (error) {
        const m = error.message.toLowerCase();
        const bad = m.includes('invalid') || m.includes('expired') || m.includes('token');
        if (bad) {
          setCodeError(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        throw new Error(bad ? t('auth.badCode') : error.message);
      }
      done('phone');
    } catch (e) {
      toast(humanError(e));
      setCode('');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- done est stable (fonction du composant)
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

  const submit = async () => {
    if (busy) return;
    const mail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(mail)) return toast(t('auth.badEmail'));
    if (password.length < 8) return toast(t('auth.shortPassword'));
    setBusy(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { emailRedirectTo: Linking.createURL('/auth-callback') } });
        if (error) throw new Error(/already|registered|exists/i.test(error.message) ? t('auth.exists') : /rate|too many|seconds/i.test(error.message) ? t('auth.slowDown') : error.message);
        if (data.session) done('email');
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) {
          const confirm = error.code === 'email_not_confirmed' || error.message.toLowerCase().includes('confirm');
          const invalid = error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message);
          if (!confirm && !invalid) throw error;
          if (invalid) {
            setPwError(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          throw new Error(confirm ? t('auth.confirmFirst') : t('auth.wrong'));
        }
        done('email');
      }
    } catch (e) {
      toast(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: 'apple' | 'google') => {
    if (busy) return;
    setBusy(true);
    try {
      if (provider === 'apple') {
        await signInWithApple();
        done('apple');
      } else if (await signInWithGoogle()) done('google');
      else toast(t('auth.cancelled'));
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast(code === 'ERR_REQUEST_CANCELED' ? t('auth.cancelled') : (e as Error).message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (busy) return;
    const mail = email.trim().toLowerCase();
    if (!mailOk) return toast(t('auth.badEmail'));
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: Linking.createURL('/auth-callback', { queryParams: { flow: 'recovery' } }) });
      if (error) throw error;
      toast(t('auth.forgotSent'));
    } catch (e) {
      toast(humanError(e));
    } finally { setBusy(false); }
  };

  const resetPassword = async () => {
    if (busy || password.length < 8) return;
    if (password !== confirmation) return toast(t('auth.passwordMismatch'));
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t('auth.linkExpired'));
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast(t('auth.passwordSaved'));
      router.replace('/');
    } catch (e) {
      toast(humanError(e));
    } finally { setBusy(false); }
  };

  if (mode === 'reset') return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Header back={() => router.replace('/auth?mode=login')} />
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <Title>{t('auth.resetTitle')}</Title>
          <Body>{t('auth.resetSub')}</Body>
          <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" textContentType="newPassword" autoComplete="new-password" />
          <Field label={t('auth.confirmPassword')} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" textContentType="newPassword" onSubmitEditing={resetPassword} />
        </ScrollView>
        <BottomCTA><Button label={t('auth.savePassword')} disabled={password.length < 8 || password !== confirmation} loading={busy} onPress={resetPassword} /></BottomCTA>
      </KeyboardAvoidingView>
    </Screen>
  );

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {/* arrivé ici directement (téléphone qui a déjà eu un compte) : le retour mène à l'accueil */}
        <Header back={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            {/* deux autocollants glissés au-dessus du titre, à droite : 8 px de chevauchement, jamais sur les lettres */}
            <View style={s.stickers} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Animated.View entering={ZoomIn.delay(120).springify().damping(10)} style={{ transform: [{ rotate: '-6deg' }] }}>
                <Sticker kind="melt" size="sm" />
              </Animated.View>
              <Animated.View entering={ZoomIn.delay(200).springify().damping(10)} style={{ transform: [{ rotate: '6deg' }] }}>
                <Sticker kind="lol" size="sm" />
              </Animated.View>
            </View>
            <Title size={48}>{sending ? t('auth.titleSend') : signup ? t('auth.titleSignup') : t('auth.titleLogin')}</Title>
            <Body>{sending ? t('auth.subSend') : signup ? t('auth.subSignup') : t('auth.subLogin')}</Body>
          </View>
          <View style={s.socials}>
            {appleOk && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={signup ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={29}
                style={s.apple}
                onPress={() => social('apple')}
              />
            )}
            <Pressable accessibilityRole="button" onPress={() => social('google')} style={({ pressed }) => [s.google, pressed && { opacity: 0.7 }]} disabled={busy}>
              <GoogleG />
              <Text style={s.googleT}>{t('auth.google')}</Text>
            </Pressable>
          </View>
          <View style={s.orRow}>
            <View style={s.orLine} />
            <Text style={s.orT}>{t('auth.or')}</Text>
            <View style={s.orLine} />
          </View>
          {method === 'phone' ? (
            <>
              <Field
                label={t('phone.number')}
                prefix={
                  <NativeMenu title={t('phone.country')} items={PHONE_COUNTRIES.map((x) => ({ id: x.c, title: `${x.flag}  ${x.dial}` }))} onSelect={(id) => { setCountry(id as CountryCode); setE164(null); }} label={t('phone.country')}>
                    <View style={s.dialPill}>
                      <Text style={s.dialPillT}>{cur.flag}  {cur.dial}</Text>
                      <Icon name="chevronDown" size={12} color={colors.muted} stroke={3} />
                    </View>
                  </NativeMenu>
                }
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  setE164(null);
                  setCode('');
                }}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={sendCode}
                placeholder={country === 'FR' ? t('phone.placeholder') : t('phone.placeholderOther')}
                right={e164 ? <OkDot /> : null}
              />
              {e164 ? (
                <View style={{ gap: 10 }}>
                  <Field
                    ref={codeRef}
                    label={t('phone.code')}
                    value={code}
                    onChangeText={(v) => {
                      setCode(v.replace(/\D/g, '').slice(0, 6));
                      setCodeError(false);
                    }}
                    error={codeError}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={6}
                    style={s.code}
                    onSubmitEditing={verify}
                    returnKeyType="go"
                  />
                  {codeError ? (
                    <Text style={s.err} accessibilityLiveRegion="polite">
                      {t('auth.badCode')}
                    </Text>
                  ) : null}
                  <View style={{ opacity: cooldown > 0 || busy ? 0.5 : 1 }}>
                    <TextLink label={cooldown > 0 ? t('phone.resendIn', { n: cooldown }) : t('phone.resend')} arrow={false} disabled={cooldown > 0 || busy} onPress={sendCode} />
                  </View>
                </View>
              ) : null}
              <TextLink label={t('auth.useEmail')} onPress={() => setMethod('email')} />
            </>
          ) : (
            <>
              <Field
                label={t('auth.email')}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setPwError(false);
                }}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                placeholder={t('auth.emailPlaceholder')}
                right={mailOk ? <OkDot /> : null}
              />
              <Field
                label={t('auth.password')}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setPwError(false);
                }}
                error={pwError}
                secureTextEntry={!showPw}
                textContentType={signup ? 'newPassword' : 'password'}
                autoComplete={signup ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={submit}
                returnKeyType="go"
                hint={signup ? t('auth.shortPassword') : undefined}
                right={
                  <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={showPw ? t('auth.passwordHide') : t('auth.passwordShow')}>
                    <Icon name={showPw ? 'eyeOff' : 'eye'} size={20} color={colors.muted} />
                  </Pressable>
                }
              />
              {pwError ? (
                <Text style={s.err} accessibilityLiveRegion="polite">
                  {t('auth.wrong')}
                </Text>
              ) : null}
              {/* « mot de passe oublié » seul, aligné à droite sous le champ (connexion uniquement) */}
              {!signup && <TextLink label={t('auth.forgot')} arrow={false} align="flex-end" onPress={forgot} />}
              <TextLink label={t('auth.usePhone')} onPress={() => setMethod('phone')} />
            </>
          )}
        </ScrollView>
        <BottomCTA>
          {/* bascule inscription ⇄ connexion : une ligne centrée, sans souligné */}
          <View style={s.switchRow}>
            <Text style={s.switchMuted}>{signup ? t('auth.haveAccount') : t('auth.noAccount')}</Text>
            <TextLink label={signup ? t('auth.loginLink') : t('auth.signupLink')} arrow={false} onPress={() => router.setParams({ mode: signup ? 'login' : 'signup' })} />
          </View>
          <Button
            label={method === 'email' ? t('auth.validate') : e164 ? t('phone.verify') : t('phone.send')}
            arrow
            loading={busy}
            disabled={method === 'email' ? !ready : e164 ? code.length < 6 : !toE164(phone, country)}
            onPress={method === 'email' ? submit : e164 ? verify : sendCode}
            haptic="medium"
          />
          {signup && legal.termsUrl ? (
            <Pressable onPress={() => Linking.openURL(legal.termsUrl!)} accessibilityRole="link" style={{ paddingTop: 10 }}>
              <Text style={s.legal}>{t('auth.legal')}</Text>
            </Pressable>
          ) : null}
        </BottomCTA>
      </KeyboardAvoidingView>

      {sent && (
        <View style={[StyleSheet.absoluteFill, s.sent]}>
          <Fondue mood="happy" size={120} />
          <Title size={44} style={{ textAlign: 'center' }}>
            {t('auth.sent')}
          </Title>
          <Body style={{ textAlign: 'center', color: colors.muted }}>{t('auth.sentSub')}</Body>
          <Button label={t('auth.confirmed')} onPress={() => router.replace({ pathname: '/auth', params: { mode: 'login', ...(next ? { next } : {}) } })} />
        </View>
      )}
    </Screen>
  );
}

function OkDot() {
  return (
    <View style={s.ok}>
      <Icon name="check" size={13} stroke={3.4} />
    </View>
  );
}

function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <Path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z" />
      <Path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
    </Svg>
  );
}

const s = StyleSheet.create({
  stickers: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', alignSelf: 'flex-end', marginBottom: -14, zIndex: 1 },
  form: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20, gap: 20 },
  socials: { gap: 12 },
  apple: { height: 58, width: '100%' },
  google: { height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleT: { ...tx.bold, fontSize: 17, color: colors.ink },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.sand },
  orT: { ...tx.black, fontSize: 14, color: colors.muted },
  code: { letterSpacing: 10, textAlign: 'center' as const, ...tx.black, fontSize: 22 },
  dialPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.paper },
  dialPillT: { ...tx.black, fontSize: 16, color: colors.ink },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 8 },
  switchMuted: { ...tx.text, fontSize: 15, color: colors.muted },
  sent: { backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 },
  legal: { ...tx.text, fontSize: 12, lineHeight: 16, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline' },
  ok: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.pistache, alignItems: 'center', justifyContent: 'center' },
  err: { ...tx.bold, fontSize: 13, color: colors.ceriseDeep, marginTop: -10 },
});
