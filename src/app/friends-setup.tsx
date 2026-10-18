import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bounce } from '../components/Bounce';
import { QrCode } from '../components/QrCode';
import { useToast } from '../components/Toast';
import { Icon, type IconName } from '../components/Icon';
import { Logo } from '../components/Logo';
import { Avatar, BackButton, BottomCTA, Button, Chip, Pop, Screen, SectionLabel, Title } from '../components/ui';
import { t, humanError } from '../i18n';
import { acceptInvite, addFriend, inviteUrl, listFriends, mySettings, type Profile } from '../lib/api';
import { findFriendsInContacts, shareMoreContacts, type ContactsResult } from '../lib/contacts';
import { draft } from '../lib/draft';
import { registerForPush, shouldAskPush } from '../lib/push';
import { parseInvite, shareInviteLink } from '../lib/invite';
import { track } from '../lib/monitoring';
import { useSession } from '../lib/session';
import { colors, fonts, tx } from '../theme';

const GOAL = 3;

/**
 * Juste après l'inscription : ajouter 3 amis. C'est l'étape qui décide si l'app sert à quelque chose.
 * Carnet d'adresses, lien, QR code, lien d'invitation copié depuis le web.
 */
export default function FriendsSetup() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromContacts = from === 'contacts';
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { profile, session } = useSession();
  const me = profile?.username ?? '';
  const [count, setCount] = useState(0);
  const [found, setFound] = useState<Profile[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [denied, setDenied] = useState(false);
  const [limited, setLimited] = useState<number | null>(null);
  const [hasPhone, setHasPhone] = useState(true);
  const [qr, setQr] = useState(false);

  const refresh = useCallback(() => {
    listFriends()
      .then((f) => setCount(f.length))
      .catch(() => {});
    mySettings()
      .then((s) => setHasPhone(s.has_phone))
      .catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const searchContacts = async (more = false) => {
    if (searching) return;
    setSearching(true);
    try {
      const r: ContactsResult = more ? await shareMoreContacts() : await findFriendsInContacts(true);
      if (r.status === 'denied') setDenied(true);
      else {
        setDenied(false);
        setFound(r.friends);
        setLimited(r.limited ? r.shared : null);
        track('contacts_matched', { scanned: r.scanned, found: r.friends.length, limited: r.limited });
      }
    } catch (e) {
      toast(humanError(e));
    } finally {
      setSearching(false);
    }
  };

  const add = async (p: Profile) => {
    try {
      await addFriend(p.username);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAdded((s) => new Set(s).add(p.id));
      setCount((c) => c + 1);
      track('friend_added', { source: 'contacts' });
    } catch (e) {
      toast(humanError(e));
    }
  };

  const paste = async (text: string) => {
    const inv = parseInvite(text);
    if (!inv) return toast(t('friends.pasteNone'));
    try {
      const p = await acceptInvite(inv.name, inv.source);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(t('invite.added', { name: p.username }));
      track('invite_pasted', { source: inv.source });
      refresh();
    } catch (e) {
      toast(humanError(e));
    }
  };

  const finish = async () => {
    track('friends_step_done', { friends: count });
    // des amis ajoutés : c'est le moment de demander les notifications (« quand ils t'envoient un secret »)
    if (count > 0 && session && (await shouldAskPush())) {
      await registerForPush(session.user.id, true).catch(() => {});
      track('push_prompt', { at: 'friends_step' });
    }
    if (fromContacts && router.canGoBack()) router.back();
    // premier secret écrit avant l'inscription : on va l'envoyer
    else if (draft.pending) router.replace('/sendto');
    else router.replace('/camera');
  };

  return (
    <Screen>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <View style={s.topRow}>
          {fromContacts ? <BackButton /> : <View style={{ width: 40 }} />}
          {/* logo centré, comme sur les autres écrans */}
          <View style={s.logo} pointerEvents="none">
            <Logo size={24} color={colors.ink} />
          </View>
          <Text style={s.progressT} accessibilityLabel={t('friends.progress', { n: Math.min(count, GOAL) })}>
            {t('friends.progress', { n: Math.min(count, GOAL) })}
          </Text>
        </View>
        {!fromContacts && <SectionLabel>{t('friends.step')}</SectionLabel>}
        <Title size={44}>{t('friends.title')}</Title>
        <Text style={s.sub}>{t('friends.sub')}</Text>
        <View style={s.slots}>
          {Array.from({ length: GOAL }, (_, i) => (
            <Slot key={i} on={i < count} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        {/* carnet d'adresses */}
        <Animated.View entering={FadeInDown.springify()} layout={LinearTransition.springify()}>
          <Pop style={s.card}>
            <View style={s.cardHead}>
              <View style={[s.cardIc, { backgroundColor: colors.okBg }]}>
                <Icon name="users" size={20} />
              </View>
              <Text style={s.cardT}>{t('friends.contacts')}</Text>
            </View>
            <Text style={s.hint}>{t('friends.contactsHint')}</Text>
            {found === null ? (
              <Button label={t('friends.contactsBtn')} size="md" loading={searching} onPress={() => searchContacts()} style={{ marginTop: 6 }} />
            ) : found.length === 0 ? (
              <Text style={s.empty}>{t('friends.contactsNone')}</Text>
            ) : (
              <View style={{ gap: 2 }}>
                <Text style={s.found}>{t('friends.found', { n: found.length })}</Text>
                {found.map((p) => {
                  const on = added.has(p.id);
                  return (
                    <View key={p.id} style={s.row}>
                      <Avatar name={p.username} uri={p.avatar_url} />
                      <Text style={s.name}>{p.username}</Text>
                      <Button size="sm" tone={on ? 'white' : 'nuit'} icon={on ? 'check' : undefined} label={on ? t('friends.added') : t('friends.add')} onPress={() => !on && add(p)} accessibilityLabel={`${t('friends.add')} ${p.username}`} />
                    </View>
                  );
                })}
              </View>
            )}
            {limited !== null ? (
              <View style={s.limited}>
                <Text style={s.empty}>{t('friends.limited', { n: limited })}</Text>
                <Button label={t('friends.limitedMore')} tone="white" size="md" icon="userPlus" loading={searching} onPress={() => searchContacts(true)} />
              </View>
            ) : null}
            {denied ? <Text style={s.empty}>{t('friends.contactsDenied')}</Text> : null}
            <Pressable onPress={() => router.push('/phone')} style={s.link} accessibilityRole="button" disabled={hasPhone}>
              <Icon name={hasPhone ? 'check' : 'phone'} size={17} color={hasPhone ? colors.muted : colors.ink} />
              <Text style={[s.linkT, hasPhone && { color: colors.muted }]}>{hasPhone ? t('friends.phoneDone') : t('friends.phone')}</Text>
            </Pressable>
          </Pop>
        </Animated.View>

        {/* lien, QR, scan */}
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <Pop style={s.card}>
            <View style={s.cardHead}>
              <View style={[s.cardIc, { backgroundColor: colors.riskBg }]}>
                <Icon name="link" size={20} />
              </View>
              <Text style={s.cardT}>{t('friends.share')}</Text>
            </View>
            <Text style={s.hint} numberOfLines={1}>
              {inviteUrl(me).replace(/^https?:\/\//, '')}
            </Text>
            <View style={s.actions}>
              <Tile icon="share" label={t('contacts.shareLink')} onPress={() => shareInviteLink(me)} />
              <Tile
                icon="qr"
                label={t('friends.qr')}
                onPress={() => {
                  setQr(true);
                  track('qr_shown');
                }}
              />
              <Tile icon="scan" label={t('friends.scan')} onPress={() => router.push('/scan')} />
            </View>
          </Pop>
        </Animated.View>

        {/* lien d'invitation copié depuis la page web, avant l'installation */}
        <Animated.View entering={FadeInDown.delay(160).springify()}>
          {Clipboard.isPasteButtonAvailable ? (
            <Clipboard.ClipboardPasteButton
              onPress={(d) => d.type === 'text' && paste(d.text)}
              acceptedContentTypes={['url', 'plain-text']}
              displayMode="iconAndLabel"
              cornerStyle="capsule"
              backgroundColor={colors.card}
              foregroundColor={colors.ink}
              style={s.pasteNative}
            />
          ) : (
            <Button label={t('friends.paste')} icon="clipboard" tone="white" size="md" onPress={async () => paste(await Clipboard.getStringAsync())} />
          )}
        </Animated.View>
      </ScrollView>

      <BottomCTA>
        <Button label={count >= GOAL ? (fromContacts ? t('friends.done') : draft.pending ? t('friends.goSend') : t('friends.goCamera')) : t('friends.later')} tone={count >= GOAL ? 'nuit' : 'white'} arrow={count >= GOAL} onPress={finish} />
      </BottomCTA>

      <Modal visible={qr} transparent animationType="fade" onRequestClose={() => setQr(false)}>
        <Pressable style={s.modalBg} onPress={() => setQr(false)} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <Pop style={s.qrCard} radius={28} bg={colors.white}>
            <Title size={30}>{t('friends.qrTitle')}</Title>
            <View style={s.qrBox}>
              <QrCode value={`${inviteUrl(me)}?src=qr`} size={220} />
            </View>
            <Chip label={`@${me}`} tone="pistache" />
          </Pop>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Slot({ on }: { on: boolean }) {
  return (
    <Animated.View key={on ? 'on' : 'off'} entering={on ? ZoomIn.springify().damping(9) : undefined} style={[s.slot, on && { backgroundColor: colors.pistache, borderStyle: 'solid', borderColor: colors.pistache }]}>
      {on ? <Icon name="check" size={22} stroke={3} color={colors.cacao} /> : <Icon name="userPlus" size={20} color={colors.muted} />}
    </Animated.View>
  );
}

function Tile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Bounce onPress={onPress} style={s.action} accessibilityRole="button" haptic="light">
      <Icon name={icon} size={24} />
      <Text style={s.actionT}>{label}</Text>
    </Bounce>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 22, paddingBottom: 6, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, minHeight: 40 },
  logo: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  sub: { ...tx.text, fontSize: 15, lineHeight: 21, color: colors.ink },
  slots: { flexDirection: 'row', gap: 10, marginTop: 6 },
  slot: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: colors.dashed, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  progressT: { ...tx.black, fontSize: 14, color: colors.ink },
  list: { padding: 20, gap: 18, paddingBottom: 24 },
  card: { padding: 16, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardT: { flex: 1, ...tx.black, fontSize: 18, color: colors.ink },
  hint: { ...tx.text, fontSize: 13, lineHeight: 18, color: colors.muted },
  pasteNative: { height: 50, alignSelf: 'stretch' },
  found: { ...tx.bold, fontSize: 13, color: colors.ink, marginVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  name: { flex: 1, ...tx.bold, fontSize: 15, color: colors.ink },
  empty: { ...tx.text, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 4 },
  limited: { gap: 8, marginTop: 4 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 },
  linkT: { flex: 1, ...tx.bold, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  action: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, backgroundColor: colors.ghost },
  actionT: { ...tx.bold, fontSize: 11.5, color: colors.ink, textAlign: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(22,15,18,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrCard: { padding: 24, alignItems: 'center', gap: 16 },
  qrBox: { padding: 10, borderRadius: 18, backgroundColor: colors.white },
});
