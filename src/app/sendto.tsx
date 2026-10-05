import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Icon } from '../components/Icon';
import { SentCelebration } from '../components/SentCelebration';
import { Shimmer } from '../components/Shimmer';
import { useToast } from '../components/Toast';
import { Avatar, BottomCTA, Button, Check, Header, Pop, Row, Screen, SectionLabel, StreakPill } from '../components/ui';
import { t } from '../i18n';
import { ApiError, forgetLocalPhoto, listFriends, myStreaks, sendFlip, type LinkKind, type Profile, type Streak } from '../lib/api';
import { makePreview } from '../lib/preview';
import { renderStoryImage, shareStory } from '../lib/story';
import { track } from '../lib/monitoring';
import { play } from '../lib/sounds';
import { useSession } from '../lib/session';
import { draft } from '../lib/draft';
import { inviteBySms } from '../lib/invite';
import { registerForPush, shouldAskPush } from '../lib/push';
import { signature } from '../lib/haptics';
import { tx, useStyles, useTheme, type Palette } from '../theme';

/** « envoyer à » : ses potes d'abord (séries en danger en tête), puis le lien ou la story. */
export default function SendTo() {
  const { colors } = useTheme();
  const s = useStyles(themed);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [friends, setFriends] = useState<Profile[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(draft.replyTo ? [draft.replyTo] : []));
  const [q, setQ] = useState('');
  const once = draft.mode === 'once';
  const { profile, session } = useSession();
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<{ message: string; retryable: boolean } | null>(null);
  const [sent, setSent] = useState<{ to: string; sweet: boolean; streak: number; ask: boolean; noFriends: boolean } | null>(null);
  const [link, setLink] = useState<LinkKind | null>(null);
  const [streaks, setStreaks] = useState<Map<string, Streak>>(new Map());

  useEffect(() => {
    listFriends().then(setFriends).catch(() => setFriends([]));
    myStreaks().then(setStreaks).catch(() => {});
  }, []);

  const pickLink = (k: LinkKind) => {
    Haptics.selectionAsync();
    setLink((cur) => (cur === k ? null : k));
  };

  // séries en danger d'abord, puis les plus longues séries, puis l'alphabet
  const shown = useMemo(() => {
    const rank = (f: Profile) => {
      const st = streaks.get(f.id);
      return st ? (st.at_risk ? 100000 : 0) + st.days : -1;
    };
    return (friends ?? []).filter((f) => f.username.includes(q.trim().toLowerCase())).sort((a, b) => rank(b) - rank(a) || a.username.localeCompare(b.username));
  }, [friends, q, streaks]);

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const invite = async () => {
    if (!(await inviteBySms(profile?.username ?? ''))) toast(t('common.smsUnavailable'));
  };

  const send = async () => {
    if ((!selected.size && !link) || sending) return;
    setSending(true);
    setFailure(null);
    setProgress(0);
    try {
      const preview = await makePreview(draft.uri);
      const uri = draft.uri;
      const r = await sendFlip({ localUri: uri, message: draft.message, mode: once && link !== 'story' ? 'once' : 'free', recipients: [...selected], link, preview }, setProgress);
      signature();
      play(r.streak >= 2 ? 'streak' : 'sent');
      track('flip_sent', { recipients: r.sent_to, once, sweet_hour: r.sweet_hour, reply: !!draft.replyTo, link: link ?? 'none' });

      // partage du lien hors de l'app
      if (r.link === 'single' && r.link_url) {
        const res = await Share.share({ message: t('link.message', { url: r.link_url }) });
        if (res.action === Share.sharedAction) track('link_shared', { via: res.activityType ?? 'share' });
      } else if (r.link === 'story' && r.link_url) {
        try {
          const image = await renderStoryImage(uri);
          toast(t('story.copied'));
          await shareStory(image, r.link_url);
          track('story_shared');
        } finally {
          forgetLocalPhoto(uri);
        }
      }

      const one = friends?.find((f) => selected.has(f.id))?.username ?? t('send.yourFriend');
      const to = r.sent_to > 1 ? t('send.manyFriends', { n: r.sent_to }) : r.sent_to === 1 ? one : r.link === 'story' ? t('link.sentStory') : t('link.sentPrivate');
      draft.reset();
      const ask = await shouldAskPush();
      // envoyé uniquement par lien, sans ami dans l'app : le succès propose d'en ajouter
      const noFriends = (friends?.length ?? 0) === 0 && r.sent_to === 0;
      setSent({ to, sweet: r.sweet_hour, streak: r.streak, ask, noFriends });
      if (!ask && !noFriends) setTimeout(leave, 1500);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(undefined, (e as Error).message, true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      track('send_failed', { code: err.code ?? 'unknown' });
      setFailure({ message: err.message, retryable: err.retryable || err.code === 'OFFLINE' || err.code === 'UPLOAD' });
    } finally {
      setSending(false);
    }
  };

  const leave = () => {
    router.dismissAll();
    router.replace('/camera');
  };

  const n = selected.size;
  const names = (friends ?? []).filter((f) => selected.has(f.id)).map((f) => f.username);
  const cta =
    n && link
      ? t('send.ctaPlusLink', { n })
      : n > 2
        ? t('send.ctaMany', { n })
        : n === 2
          ? t('send.ctaTwo', { a: names[0] ?? '', b: names[1] ?? '' })
          : n === 1
            ? t('send.ctaTo', { name: names[0] ?? '' })
            : link === 'story'
              ? t('send.ctaStory')
              : link
                ? t('send.ctaLink')
                : t('send.pick');
  const hasFriends = (friends?.length ?? 0) > 0;

  const linksBlock = (
    <View style={{ gap: 10 }}>
      <SectionLabel>{t('link.section')}</SectionLabel>
      <View style={s.links}>
        {(['single', 'story'] as const).map((k) => {
          const on = link === k;
          return (
            <Pressable key={k} onPress={() => pickLink(k)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${t(k === 'single' ? 'link.private' : 'link.story')}. ${t(k === 'single' ? 'link.privateHint' : 'link.storyHint')}`} style={{ flex: 1 }}>
              <Pop bg={on ? colors.cerise : colors.card} border={on ? colors.cerise : colors.line} radius={20} style={s.linkCard}>
                <View style={s.linkTop}>
                  <Icon name={k === 'single' ? 'link' : 'story'} size={24} color={on ? colors.vanille : colors.ink} />
                  <View style={[s.radio, on && { backgroundColor: colors.vanille, borderColor: colors.vanille }]}>{on && <Icon name="check" size={12} stroke={3.4} />}</View>
                </View>
                <Text style={[s.linkT, on && { color: colors.vanille }]}>{t(k === 'single' ? 'link.private' : 'link.story')}</Text>
                <Text style={[s.linkS, on && { color: colors.vanille }]} numberOfLines={3}>
                  {t(k === 'single' ? 'link.privateHint' : 'link.storyHint')}
                </Text>
              </Pop>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen>
      <Header title={t('send.title')} back />
      <View style={s.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('send.search')} accessibilityLabel={t('send.search')} placeholderTextColor={colors.muted} style={s.searchInput} autoCapitalize="none" autoCorrect={false} selectionColor={colors.cerise} />
      </View>

      {/* ce qu'on envoie reste visible : la photo et le secret, pendant qu'on choisit les destinataires */}
      {draft.uri ? (
        <View style={s.draft} accessibilityElementsHidden={false} accessible accessibilityLabel={t('send.yourFlip')}>
          <View style={s.draftThumb}>
            <ExpoImage source={{ uri: draft.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.draftMsg} numberOfLines={2}>
              {draft.message}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={once ? 'lock' : 'eye'} size={11} color={colors.muted} stroke={2.8} />
              <Text style={s.draftMeta}>{once ? t('send.once') : t('send.free')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <FlatList
        data={shown}
        ListHeaderComponent={
          <View style={{ gap: 10, paddingBottom: 10 }}>
            {!hasFriends && friends !== null ? linksBlock : null}
            <SectionLabel style={{ marginTop: !hasFriends && friends !== null ? 14 : 0 }}>{t('send.friends')}</SectionLabel>
          </View>
        }
        keyExtractor={(f) => f.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          friends === null ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <Shimmer key={i} style={{ height: 60, borderRadius: 18 }} />
              ))}
            </View>
          ) : (
            <Text style={s.empty}>{q ? t('send.noMatch') : t('send.empty')}</Text>
          )
        }
        renderItem={({ item, index }) => {
          const on = selected.has(item.id);
          const st = streaks.get(item.id);
          return (
            <Animated.View entering={FadeInDown.springify().delay(Math.min(index, 10) * 30)}>
              <Row onPress={() => toggle(item.id)} active={on} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={st?.at_risk ? t('streak.atRisk', { n: st.days, name: item.username }) : item.username} style={{ backgroundColor: on ? colors.card : 'transparent', marginHorizontal: 0, paddingHorizontal: 12, borderRadius: 20 }}>
                <Avatar name={item.username} uri={item.avatar_url} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.username}</Text>
                  {st?.at_risk ? <Text style={s.risk}>{t('contacts.atRiskSub')}</Text> : null}
                </View>
                {st ? <StreakPill days={st.days} atRisk={st.at_risk} /> : null}
                <Check on={on} />
              </Row>
            </Animated.View>
          );
        }}
        ListFooterComponent={
          <View style={{ gap: 10, paddingTop: 18 }}>
            {hasFriends ? linksBlock : null}
            <Pressable style={s.invite} onPress={invite} accessibilityRole="button">
              <Icon name="message" size={18} color={colors.cerise} />
              <Text style={s.inviteT}>{t('send.inviteSms')}</Text>
            </Pressable>
          </View>
        }
      />

      {failure && !sending && (
        <Animated.View entering={FadeInDown.springify()} style={[s.fail, { bottom: 104 + insets.bottom }]} accessibilityLiveRegion="assertive">
          <Pop bg={colors.card2} border={colors.card2} radius={20} style={s.failIn}>
            <View style={{ flex: 1 }}>
              <Text style={s.failT}>{t('send.failed')}</Text>
              <Text style={s.failB}>{failure.message}</Text>
            </View>
            {failure.retryable && <Button size="sm" tone="cerise" label={t('common.retry')} onPress={send} />}
          </Pop>
        </Animated.View>
      )}
      <BottomCTA style={s.ctaBar}>
        <Button label={sending ? t('send.uploading', { p: Math.round(progress * 100) }) : cta} arrow={!sending && (!!n || !!link)} disabled={(!n && !link) || sending} onPress={send} haptic="medium" accessibilityLiveRegion="polite" />
        {sending ? (
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.max(4, progress * 100)}%` }]} />
          </View>
        ) : null}
      </BottomCTA>
      {sent && (
        <SentCelebration
          to={sent.to}
          sweet={sent.sweet}
          streak={sent.streak}
          cta={sent.noFriends ? { label: t('send.findFriends'), onPress: () => { track('sent_friends_cta'); router.push({ pathname: '/friends-setup', params: { from: 'send' } }); }, onDismiss: leave } : undefined}
          ask={
            sent.ask
              ? {
                  onAllow: async () => {
                    if (session) await registerForPush(session.user.id, true).catch(() => {});
                    track('push_prompt', { at: 'first_send' });
                    leave();
                  },
                  onLater: leave,
                }
              : undefined
          }
        />
      )}
    </Screen>
  );
}

const themed = (colors: Palette) =>
  StyleSheet.create({
  search: { marginHorizontal: 20, marginTop: 4, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  draft: { marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  draftThumb: { width: 44, height: 58, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.sand },
  draftMsg: { ...tx.bold, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  draftMeta: { ...tx.text, fontSize: 11.5, color: colors.muted },
  searchInput: { flex: 1, ...tx.bold, fontSize: 15, color: colors.ink },
  list: { paddingHorizontal: 20, paddingBottom: 150 },
  links: { flexDirection: 'row', gap: 12 },
  linkCard: { padding: 12, gap: 6, minHeight: 128 },
  linkTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.dashed, alignItems: 'center', justifyContent: 'center' },
  linkT: { ...tx.black, fontSize: 15, lineHeight: 18, color: colors.ink },
  linkS: { ...tx.text, fontSize: 12, lineHeight: 16, color: colors.muted },
  name: { ...tx.black, fontSize: 16.5, color: colors.ink },
  risk: { ...tx.bold, fontSize: 12, color: colors.ceriseDeep },
  empty: { ...tx.text, fontSize: 15, color: colors.muted, paddingVertical: 10, lineHeight: 21 },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  inviteT: { ...tx.black, fontSize: 15, color: colors.cerise },
  ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 10 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sand, overflow: 'hidden', marginHorizontal: 8 },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.cerise },
  fail: { position: 'absolute', left: 20, right: 24 },
  failIn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  failT: { ...tx.black, fontSize: 15, color: colors.vanille },
  failB: { ...tx.text, fontSize: 13, color: colors.mutedOnDark, marginTop: 2 },
});
