import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Avatar, Body, Button, Field, Header, Pop, Screen, SectionLabel, Skeleton, Title, Toggle } from '../components/ui';
import { lang, setLang, t, humanError } from '../i18n';
import { registerForPush, unregisterPush } from '../lib/push';
import { clearHasAccount, LOGIN_ROUTE } from '../lib/returning';
import { legal } from '../lib/legal';
import { deleteAccount, mySettings, setAvatar, setDiscoverable, myMute, setMute, type PushKind } from '../lib/api';
import { useSelfiePicker } from '../components/AvatarPicker';
import { useSession } from '../lib/session';
import { updateWidget } from '../lib/widget';
import { analyticsAvailable, analyticsEnabled, setAnalytics } from '../lib/monitoring';
import { setSoundsEnabled, soundsEnabled } from '../lib/sounds';
import { supabase } from '../lib/supabase';
import { colors, fonts, tx } from '../theme';


/** Compte : pseudo, liens légaux, déconnexion, suppression du compte. */
export default function Settings() {
  const toast = useToast();
  const { session, profile, refreshProfile } = useSession();
  const [avatar, setAvatarUri] = useState<string | null>(null);
  const { pick: pickSelfie, sheet: selfieSheet } = useSelfiePicker();
  const username = profile?.username ?? null;
  const email = session?.user.email ?? '';
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(analyticsEnabled());
  const [sounds, setSounds] = useState(soundsEnabled());
  const [disc, setDisc] = useState<boolean | null>(null);
  const [hasPhone, setHasPhone] = useState(false);
  // notifications par type : null tant qu'elles ne sont pas autorisées sur ce téléphone
  const [mute, setMuteState] = useState<PushKind[] | null | undefined>(undefined);
  useEffect(() => {
    myMute().then(setMuteState).catch(() => setMuteState(null));
  }, []);
  const toggleKind = (k: PushKind, on: boolean) => {
    const prev = mute ?? [];
    const next = on ? prev.filter((x) => x !== k) : [...prev.filter((x) => x !== k), k];
    setMuteState(next);
    setMute(next).catch((e) => {
      setMuteState(prev);
      toast(humanError(e));
    });
  };
  const enablePush = async () => {
    if (session) await registerForPush(session.user.id, true).catch(() => {});
    const m = await myMute().catch(() => null);
    if (m === null) Linking.openSettings();
    setMuteState(m);
  };
  useEffect(() => {
    mySettings()
      .then((x) => {
        setDisc(x.discoverable);
        setHasPhone(x.has_phone);
      })
      .catch(() => {});
  }, []);

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unregisterPush();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      updateWidget([]);
      if (router.canDismiss()) router.dismissAll(); // sans pile (lien ouvert à froid), dismissAll lève une erreur
      router.replace(LOGIN_ROUTE); // on revient se connecter, pas redécouvrir l'app
    } catch (e) {
      toast(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  // suppression irréversible : il faut retaper son pseudo, pas un simple oui/non (footgun)
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const remove = () => {
    setTyped('');
    setConfirming(true);
  };
  const confirmDelete = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      clearHasAccount();
      updateWidget([]);
      await supabase.auth.signOut();
      setConfirming(false);
      if (router.canDismiss()) router.dismissAll(); // sans pile (lien ouvert à froid), dismissAll lève une erreur
      router.replace('/welcome');
      toast(t('settings.deleted'));
    } catch (e) {
      toast(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const row = (label: string, onPress: () => void, icon?: IconName) => (
    <Pressable style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]} onPress={onPress} accessibilityRole="button">
      {icon && <Icon name={icon} size={19} />}
      <Text style={[s.label, { flex: 1 }]}>{label}</Text>
      <Icon name="arrow" size={17} color={colors.muted} />
    </Pressable>
  );
  const sw = (label: string, hint: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={s.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.hint}>{hint}</Text>
      </View>
      <Toggle label={label} value={value} onValueChange={onChange} />
    </View>
  );

  return (
    <Screen>
      <Header title={t('settings.title')} back />
      <ScrollView contentContainerStyle={s.scroll}>
        <Pop radius={24} style={s.me}>
          {username ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('avatar.change')}
              onPress={async () => {
                const u = await pickSelfie();
                if (!u) return;
                setAvatarUri(u);
                try {
                  await setAvatar(u);
                  await refreshProfile();
                  setAvatarUri(null); // la photo servie (celle que voient les autres) remplace la preview locale
                  toast(t('avatar.saved'));
                } catch (e) {
                  setAvatarUri(null);
                  toast(humanError(e));
                }
              }}
            >
              <Avatar name={username} uri={avatar ?? profile?.avatar_url} size={58} />
              <View style={s.camBadge}>
                <Icon name="snap" size={12} color={colors.onBrand} stroke={2.6} />
              </View>
            </Pressable>
          ) : (
            // profil en cours : des os qui attendent la photo, jamais un pseudo « @… »
            <Skeleton width={56} height={56} radius={28} base={colors.sand} />
          )}
          <View style={{ flex: 1 }}>
            {username ? (
              <>
                <Text style={s.meName} numberOfLines={1}>
                  @{username}
                </Text>
                <Text style={s.meMail} numberOfLines={1}>
                  {email}
                </Text>
              </>
            ) : (
              <View style={{ gap: 8 }}>
                <Skeleton width="60%" height={18} radius={9} base={colors.sand} />
                <Skeleton width="40%" height={13} radius={7} base={colors.sand} />
              </View>
            )}
          </View>
        </Pop>

        <SectionLabel style={s.sec}>{t('settings.account')}</SectionLabel>
        <View style={s.group}>
          {sw(t('settings.sounds'), t('settings.soundsHint'), sounds, (v) => {
            setSounds(v);
            setSoundsEnabled(v);
          })}
          <View style={s.sep} />
          <Pressable style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]} onPress={() => setLang(lang === 'fr' ? 'en' : 'fr')} accessibilityRole="button">
            <Icon name="message" size={19} />
            <Text style={[s.label, { flex: 1 }]}>{t('settings.language')}</Text>
            <Text style={s.hint}>{lang === 'fr' ? 'français' : 'english'}</Text>
          </Pressable>
        </View>

        <SectionLabel style={s.sec}>{t('settings.notifTitle')}</SectionLabel>
        <View style={s.group}>
          {mute === null ? (
            row(t('settings.notifEnable'), enablePush, 'sparkle')
          ) : mute === undefined ? null : (
            (['flips', 'reads', 'streaks', 'sweethour'] as PushKind[]).map((k, i) => (
              <View key={k}>
                {i > 0 ? <View style={s.sep} /> : null}
                {sw(t(`settings.notif_${k}`), t(`settings.notif_${k}Hint`), !mute.includes(k), (v) => toggleKind(k, v))}
              </View>
            ))
          )}
        </View>

        <SectionLabel style={s.sec}>{t('settings.privacyTitle')}</SectionLabel>
        <View style={s.group}>
          <Pressable style={s.row} onPress={() => router.push('/phone')} accessibilityRole="button">
            <Icon name="phone" size={19} />
            <Text style={[s.label, { flex: 1 }]}>{t('settings.phone')}</Text>
            {hasPhone ? <Icon name="check" size={18} stroke={3} /> : <Text style={s.add}>{t('settings.phoneAdd')}</Text>}
          </Pressable>
          {disc !== null && hasPhone && (
            <>
              <View style={s.sep} />
              {sw(t('settings.discoverable'), t('settings.discoverableHint'), disc, (v) => {
                setDisc(v);
                setDiscoverable(v).catch(() => setDisc(!v));
              })}
            </>
          )}
          {analyticsAvailable ? (
            <>
              <View style={s.sep} />
              {sw(t('settings.analytics'), t('settings.analyticsHint'), stats, (v) => {
                setStats(v);
                setAnalytics(v);
              })}
            </>
          ) : null}
        </View>

        <SectionLabel style={s.sec}>{t('settings.info')}</SectionLabel>
        <View style={s.group}>
          {legal.privacyUrl ? row(t('settings.privacy'), () => Linking.openURL(legal.privacyUrl!), 'lock') : null}
          {legal.termsUrl ? (
            <>
              <View style={s.sep} />
              {row(t('settings.terms'), () => Linking.openURL(legal.termsUrl!), 'clipboard')}
            </>
          ) : null}
          {legal.safetyUrl ? (
            <>
              <View style={s.sep} />
              {row(t('settings.safety'), () => Linking.openURL(legal.safetyUrl!), 'eye')}
            </>
          ) : null}
          {legal.supportEmail ? (
            <>
              <View style={s.sep} />
              {row(t('settings.contact'), () => Linking.openURL(`mailto:${legal.supportEmail}`), 'message')}
            </>
          ) : null}
        </View>

        <View style={{ gap: 14, marginTop: 28 }}>
          <Button label={t('settings.logout')} tone="white" size="md" onPress={logout} />
          <Pressable onPress={remove} disabled={busy} accessibilityRole="button" style={s.delete}>
            {busy ? <ActivityIndicator color={colors.ceriseDeep} /> : <Text style={s.deleteT}>{t('settings.delete')}</Text>}
          </Pressable>
        </View>
        <Text style={s.version}>sweetin {Constants.expoConfig?.version}</Text>
      </ScrollView>

      <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => setConfirming(false)}>
        <Pressable style={s.modalBg} onPress={() => !busy && setConfirming(false)} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <Pressable onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
            <Pop style={s.modalCard} radius={28} bg={colors.white}>
              <Title size={30}>{t('settings.deleteTitle')}</Title>
              <Body>{t('settings.deleteBody')}</Body>
              <Field label={t('settings.deleteConfirm')} value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} placeholder={username ? `@${username}` : ''} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label={t('common.cancel')} tone="white" size="md" style={{ flex: 1 }} onPress={() => setConfirming(false)} />
                <Button
                  label={t('common.delete')}
                  tone="cerise"
                  size="md"
                  style={{ flex: 1 }}
                  loading={busy}
                  disabled={!username || typed.trim().replace(/^@/, '').toLowerCase() !== username.toLowerCase()}
                  onPress={confirmDelete}
                />
              </View>
            </Pop>
          </Pressable>
        </Pressable>
      </Modal>
      {selfieSheet}
    </Screen>
  );
}

const s = StyleSheet.create({
  camBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.cerise, borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  me: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, marginTop: 6 },
  meName: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 22, lineHeight: 25, color: colors.ink },
  meMail: { ...tx.bold, fontSize: 13, color: colors.muted },
  sec: { marginTop: 24, marginBottom: 8 },
  group: { borderRadius: 20, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { height: 1, backgroundColor: colors.line, marginHorizontal: 14 },
  label: { ...tx.bold, fontSize: 15.5, color: colors.ink },
  hint: { ...tx.text, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 2 },
  add: { ...tx.black, fontSize: 14, color: colors.ink },
  delete: { alignSelf: 'center', paddingVertical: 10 },
  modalBg: { flex: 1, backgroundColor: 'rgba(22,15,18,0.55)', justifyContent: 'flex-start', paddingTop: '22%', paddingHorizontal: 24 },
  modalCard: { padding: 22, gap: 14 },
  deleteT: { ...tx.bold, fontSize: 14, color: colors.ceriseDeep, textDecorationLine: 'underline' },
  version: { fontFamily: fonts.display, fontSize: 12, color: colors.muted, textAlign: 'center', paddingTop: 22 },
});
