import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { Icon, type IconName } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Avatar, Button, Header, Pop, Screen, SectionLabel, Toggle } from '../components/ui';
import { t } from '../i18n';
import { legal } from '../lib/legal';
import { deleteAccount, mySettings, setAvatar, setDiscoverable } from '../lib/api';
import { pickSelfie } from '../components/AvatarPicker';
import { unregisterPush } from '../lib/push';
import { useSession } from '../lib/session';
import { updateWidget } from '../lib/widget';
import { analyticsAvailable, analyticsEnabled, setAnalytics } from '../lib/monitoring';
import { setSoundsEnabled, soundsEnabled } from '../lib/sounds';
import { supabase } from '../lib/supabase';
import { fonts, tx, useStyles, useTheme, type Palette } from '../theme';


/** Compte : pseudo, liens légaux, déconnexion, suppression du compte. */
export default function Settings() {
  const { colors } = useTheme();
  const s = useStyles(themed);
  const toast = useToast();
  const { session, profile, refreshProfile } = useSession();
  const [avatar, setAvatarUri] = useState<string | null>(null);
  const username = profile?.username ?? null;
  const email = session?.user.email ?? '';
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(analyticsEnabled());
  const [sounds, setSounds] = useState(soundsEnabled());
  const [disc, setDisc] = useState<boolean | null>(null);
  const [hasPhone, setHasPhone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    mySettings()
      .then((x) => {
        setDisc(x.discoverable);
        setHasPhone(x.has_phone);
      })
      .catch(() => {});
  }, []);

  const logout = async () => {
    updateWidget([]);
    await unregisterPush().catch(() => {});
    await supabase.auth.signOut();
    router.dismissAll();
    router.replace('/welcome');
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      updateWidget([]);
      await supabase.auth.signOut();
      router.dismissAll();
      router.replace('/welcome');
      toast(t('settings.deleted'));
    } catch (e) {
      toast((e as Error).message);
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
                  toast(t('avatar.saved'));
                } catch (e) {
                  setAvatarUri(null);
                  toast((e as Error).message);
                }
              }}
            >
              <Avatar name={username} uri={avatar ?? profile?.avatar_url} size={58} />
              <View style={s.camBadge}>
                <Icon name="snap" size={12} color={colors.vanille} stroke={2.6} />
              </View>
            </Pressable>
          ) : (
            <ActivityIndicator color={colors.ink} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.meName} numberOfLines={1}>
              @{username ?? '…'}
            </Text>
            <Text style={s.meMail} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </Pop>

        <SectionLabel style={s.sec}>{t('settings.account')}</SectionLabel>
        <View style={s.group}>
          {sw(t('settings.sounds'), t('settings.soundsHint'), sounds, (v) => {
            setSounds(v);
            setSoundsEnabled(v);
          })}
        </View>

        <SectionLabel style={s.sec}>{t('settings.privacyTitle')}</SectionLabel>
        <View style={s.group}>
          <Pressable style={s.row} onPress={() => router.push('/phone')} accessibilityRole="button">
            <Icon name="phone" size={19} />
            <Text style={[s.label, { flex: 1 }]}>{t('settings.phone')}</Text>
            {hasPhone ? <Icon name="check" size={18} stroke={3} /> : <Text style={s.add}>{t('settings.phoneAdd')}</Text>}
          </Pressable>
          {disc !== null && (
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
          <Pressable onPress={() => setConfirmDelete(true)} accessibilityRole="button" style={s.delete}>
            <Text style={s.deleteT}>{t('settings.delete')}</Text>
          </Pressable>
        </View>
        <Text style={s.version}>sweetin {Constants.expoConfig?.version}</Text>
      </ScrollView>
      <ConfirmSheet visible={confirmDelete} title={t('settings.deleteTitle')} body={t('settings.deleteBody')} confirm={t('common.delete')} busy={busy} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </Screen>
  );
}

const themed = (colors: Palette) =>
  StyleSheet.create({
  camBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.cerise, borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  me: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, marginTop: 6 },
  meName: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  meMail: { ...tx.bold, fontSize: 13, color: colors.muted },
  sec: { marginTop: 24, marginBottom: 8 },
  group: { borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { height: 1, backgroundColor: colors.line, marginHorizontal: 14 },
  label: { ...tx.bold, fontSize: 15.5, color: colors.ink },
  hint: { ...tx.text, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 2 },
  add: { ...tx.black, fontSize: 14, color: colors.cerise },
  delete: { alignSelf: 'center', paddingVertical: 10 },
  deleteT: { ...tx.bold, fontSize: 14, color: colors.ceriseDeep, textDecorationLine: 'underline' },
  version: { fontFamily: fonts.display, fontSize: 15, color: colors.muted, textAlign: 'center', paddingTop: 22 },
});
