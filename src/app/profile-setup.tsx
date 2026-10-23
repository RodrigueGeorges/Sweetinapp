import { Redirect, router } from 'expo-router';
import { Fondue } from '../components/Fondue';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
// suit le clavier image par image (Android compris), au lieu du saut de KeyboardAvoidingView
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarPicker } from '../components/AvatarPicker';
import { Logo } from '../components/Logo';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Body, BottomCTA, Button, Field, Screen, Title } from '../components/ui';
import { lang, t, humanError } from '../i18n';
import { clearHasAccount } from '../lib/returning';
import { ApiError, completeProfile, deleteAccount, setAvatar } from '../lib/api';
import { storeSaysUnderage } from '../lib/age';
import { ageAt, isoDate, parseBirth } from '../lib/format';
import { track } from '../lib/monitoring';
import { consumePendingInvite, useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { colors, tx } from '../theme';
import { MIN_AGE } from '../lib/constants';

/** Pseudo + date de naissance, après la création du compte (email, Apple ou Google). */
export default function ProfileSetup() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { refreshProfile, profile } = useSession();
  const [username, setUsername] = useState('');
  const [d, setD] = useState('');
  const [m, setM] = useState('');
  const [y, setY] = useState('');
  const [busy, setBusy] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [underage, setUnderage] = useState(false);
  const dRef = useRef<TextInput>(null);
  const mRef = useRef<TextInput>(null);
  const yRef = useRef<TextInput>(null);
  // ordre des champs à la française (JJ/MM) ou à l'américaine (MM/DD)
  const monthFirst = lang === 'en';

  const nameOk = /^[a-z0-9_.]{3,20}$/.test(username.trim());

  const submit = async () => {
    if (busy) return;
    const name = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(name)) return toast(t('err.USERNAME_INVALID'));
    const birth = parseBirth(d, m, y);
    if (!birth) return toast(t('err.AGE_INVALID'));
    // le serveur vérifie aussi : on ne fait que gagner un aller-retour
    if (ageAt(birth) < MIN_AGE) {
      completeProfile(name, isoDate(birth)).catch(() => {});
      return setUnderage(true);
    }
    setBusy(true);
    try {
      // là où la loi l'exige, le store connaît la tranche d'âge : elle prime sur la date saisie
      if (await storeSaysUnderage()) {
        completeProfile(name, '2020-01-01').catch(() => {});
        return setUnderage(true);
      }
      await completeProfile(name, isoDate(birth));
      // la photo part après : si l'envoi échoue, on la rajoutera depuis les réglages
      if (selfie) await setAvatar(selfie).catch(() => {});
      await refreshProfile();
      track('signup_completed', { step: 'profile' });
      const friend = await consumePendingInvite();
      if (friend) toast(t('invite.added', { name: friend }));
      router.replace('/friends-setup');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNDERAGE') setUnderage(true);
      else toast(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    try {
      await deleteAccount();
    } catch {}
    clearHasAccount();
    await supabase.auth.signOut();
    router.replace('/welcome');
  };

  const digits = (set: (v: string) => void, max: number, next?: () => void) => (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, max);
    set(clean);
    if (clean.length === max) next?.();
  };

  const box = (value: string, onChange: (v: string) => void, placeholder: string, flex: number, ref?: React.Ref<TextInput>, extra?: object) => (
    <TextInput
      ref={ref}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      keyboardType="number-pad"
      selectionColor={colors.ink}
      style={[s.date, { flex }]}
      accessibilityLabel={`${t('profile.birth')} ${placeholder}`}
      {...extra}
    />
  );

  // aiguillé ici par erreur alors que le profil est complet (course au login, lien profond) : on rentre
  if (profile?.onboarded) return <Redirect href="/" />;

  if (underage) {
    return (
      <Screen>
        <Animated.View entering={FadeIn} style={[s.center, { paddingTop: insets.top }]}>
          <Fondue mood="sad" size={120} />
          <Title size={46} style={{ textAlign: 'center' }}>
            {t('profile.underageTitle')}
          </Title>
          <Body style={{ textAlign: 'center' }}>{t('profile.underageBody', { age: MIN_AGE })}</Body>
        </Animated.View>
        <BottomCTA>
          <Button label={t('profile.deleteNow')} tone="cacao" loading={busy} onPress={removeAccount} />
        </BottomCTA>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ marginTop: insets.top + 10, alignItems: 'center' }}>
          <Logo size={26} color={colors.ink} />
        </View>
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 12 }}>
            {/* la progression en traits plutôt qu'en lettres : « étape 1 sur 2 » reste lue par le lecteur d'écran */}
            <View style={s.steps} accessibilityLabel={t('profile.step')}>
              <View style={[s.stepSeg, { backgroundColor: colors.ink }]} />
              <View style={[s.stepSeg, { backgroundColor: colors.sand }]} />
            </View>
            <Title size={46}>{t('profile.title')}</Title>
          </View>
          <View style={{ alignItems: 'center' }}>
            <AvatarPicker uri={selfie} name={username || 'a'} onPick={setSelfie} />
          </View>
          <Field
            label={t('profile.username')}
            hint={t('profile.usernameHint')}
            value={username}
            onChangeText={(v) => setUsername(v.replace(/\s/g, '').toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            textContentType="username"
            autoComplete="username-new"
            returnKeyType="next"
            placeholder="lea.m"
            prefix="@"
            right={nameOk ? <OkDot /> : null}
          />
          <View style={{ gap: 7 }}>
            <Text style={s.label}>{t('profile.birth')}</Text>
            <View style={s.dateRow}>
              {monthFirst ? (
                <>
                  {box(m, digits(setM, 2, () => dRef.current?.focus()), t('profile.month'), 1, mRef, { maxLength: 2 })}
                  {box(d, digits(setD, 2, () => yRef.current?.focus()), t('profile.day'), 1, dRef, { maxLength: 2 })}
                </>
              ) : (
                <>
                  {box(d, digits(setD, 2, () => mRef.current?.focus()), t('profile.day'), 1, dRef, { maxLength: 2 })}
                  {box(m, digits(setM, 2, () => yRef.current?.focus()), t('profile.month'), 1, mRef, { maxLength: 2 })}
                </>
              )}
              {box(y, digits(setY, 4), t('profile.year'), 1.6, yRef, { maxLength: 4, onSubmitEditing: submit, returnKeyType: 'go' })}
            </View>
            <Text style={s.hint}>{t('profile.birthHint', { age: MIN_AGE })}</Text>
          </View>
        </ScrollView>
        <BottomCTA>
          <Button label={t('profile.save')} arrow loading={busy} disabled={!nameOk || y.length < 4 || !d || !m} onPress={submit} haptic="medium" />
        </BottomCTA>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  form: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, gap: 24 },
  label: { ...tx.bold, fontSize: 14, color: colors.ink },
  hint: { ...tx.text, fontSize: 13, lineHeight: 18, color: colors.muted },
  dateRow: { flexDirection: 'row', gap: 10 },
  steps: { flexDirection: 'row', gap: 6 },
  stepSeg: { height: 4, flex: 1, borderRadius: 2 },
  date: { height: 56, borderRadius: 18, backgroundColor: colors.card, textAlign: 'center', ...tx.black, fontSize: 18, color: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 18 },
  ok: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.pistache, alignItems: 'center', justifyContent: 'center' },
});

function OkDot() {
  return (
    <View style={s.ok}>
      <Icon name="check" size={13} stroke={3.4} />
    </View>
  );
}
