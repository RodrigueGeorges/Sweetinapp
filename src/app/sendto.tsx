import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { SentCelebration } from '../components/SentCelebration';
import { Shimmer } from '../components/Shimmer';
import { useToast } from '../components/Toast';
import { Image } from 'expo-image';
import { Avatar, BottomCTA, Button, Check, Header, Pop, Row, Screen, SectionLabel, StreakNum, Title } from '../components/ui';
import { t } from '../i18n';
import { ApiError, forgetLocalPhoto, listFriends, myStreaks, sendFlip, type LinkKind, type Profile, type Streak } from '../lib/api';
import { queueSend } from '../lib/sendQueue';
import { makePreview } from '../lib/preview';
import { renderStoryImage, shareStory } from '../lib/story';
import { track } from '../lib/monitoring';
import { play } from '../lib/sounds';
import { useSession } from '../lib/session';
import { draft } from '../lib/draft';
import { inviteBySms } from '../lib/invite';
import { registerForPush, shouldAskPush } from '../lib/push';
import { signature } from '../lib/haptics';
import { colors, fonts, tx } from '../theme';

/** « envoyer à » : le lien privé et la story en tête, puis les amis (séries en danger d'abord). */
export default function SendTo() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [friends, setFriends] = useState<Profile[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(draft.replyTo ? [draft.replyTo] : []));
  const [q, setQ] = useState('');
  const { profile, session } = useSession();
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<{ message: string; retryable: boolean } | null>(null);
  const [sent, setSent] = useState<{ to: string; askText: string; sweet: boolean; streak: number; ask: boolean } | null>(null);
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

  // liste à deux étages : les séries à sauver en tête, puis les autres amis
  type RowItem = { kind: 'label'; id: string; text: string } | { kind: 'friend'; id: string; f: Profile };
  const rows = useMemo<RowItem[]>(() => {
    const risk = shown.filter((f) => streaks.get(f.id)?.at_risk);
    const rest = shown.filter((f) => !streaks.get(f.id)?.at_risk);
    const out: RowItem[] = [];
    if (risk.length) out.push({ kind: 'label', id: 'l-risk', text: t('send.riskSection') }, ...risk.map((f) => ({ kind: 'friend' as const, id: f.id, f })));
    if (rest.length) out.push({ kind: 'label', id: 'l-rest', text: t('send.friendsDays') }, ...rest.map((f) => ({ kind: 'friend' as const, id: f.id, f })));
    return out;
  }, [shown, streaks]);

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
    const uri = draft.uri;
    let preview: string | null = null;
    try {
      preview = await makePreview(uri);
      const r = await sendFlip({ localUri: uri, message: draft.message, mode: 'free', recipients: [...selected], link, preview }, setProgress);
      signature();
      play(r.streak >= 2 ? 'streak' : 'sent');
      track('flip_sent', { recipients: r.sent_to, sweet_hour: r.sweet_hour, reply: !!draft.replyTo, link: link ?? 'none' });

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

      // la phrase entière dépend du cas : une personne, plusieurs, un lien, une story (« 3 amis peut le gratter » était faux)
      const one = friends?.find((f) => selected.has(f.id))?.username;
      const kind = r.sent_to > 1 ? 'many' : r.sent_to === 1 ? 'one' : r.link === 'story' ? 'story' : 'link';
      const to =
        kind === 'many' ? t('send.sentMany', { n: r.sent_to }) : kind === 'one' ? t('send.sentTo', { to: one ?? t('send.someone') }) : kind === 'story' ? t('send.sentStory') : t('send.sentLink');
      const askText =
        kind === 'many' ? t('notif.askMany') : kind === 'one' ? t('notif.ask', { to: one ?? t('send.someone') }) : kind === 'story' ? t('notif.askStory') : t('notif.askLink');
      draft.reset();
      const ask = await shouldAskPush();
      setSent({ to, askText, sweet: r.sweet_hour, streak: r.streak, ask });
      if (!ask) setTimeout(leave, 1500);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(undefined, (e as Error).message, true);
      // hors connexion : le sweet attend dans la file et partira tout seul (les liens doivent repasser par le partage)
      if (err.code === 'OFFLINE' && !link && selected.size && uri) {
        await queueSend({ localUri: uri, message: draft.message, mode: 'free', recipients: [...selected], preview });
        draft.reset();
        track('send_queued', { recipients: selected.size });
        toast(t('queue.saved'));
        leave();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      track('send_failed', { code: err.code ?? 'unknown' });
      setFailure({ message: err.message, retryable: err.retryable || err.code === 'OFFLINE' || err.code === 'UPLOAD' });
    } finally {
      setSending(false);
    }
  };

  const leave = () => {
    if (router.canDismiss()) router.dismissAll(); // sans pile (lien ouvert à froid), dismissAll lève une erreur
    router.replace('/inbox');
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
              <Pop bg={on ? colors.ink : colors.card} border={on ? colors.ink : colors.line} radius={20} style={s.linkCard}>
                <View style={s.linkTop}>
                  <Icon name={k === 'single' ? 'link' : 'story'} size={24} color={on ? colors.paper : colors.ink} />
                  <View style={[s.radio, on && { backgroundColor: colors.paper, borderColor: colors.paper }]}>{on && <Icon name="check" size={12} stroke={3.4} color={colors.ink} />}</View>
                </View>
                <Text style={[s.linkT, on && { color: colors.paper }]}>{t(k === 'single' ? 'link.private' : 'link.story')}</Text>
                <Text style={[s.linkS, on && { color: colors.paper, opacity: 0.8 }]} numberOfLines={3}>
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
      <Header
        back
        right={draft.uri ? <Image source={{ uri: draft.uri }} style={s.thumb} contentFit="cover" accessibilityIgnoresInvertColors /> : undefined}
      />
      <Title size={44} style={s.title}>
        {t('send.title')}
      </Title>
      <View style={s.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('send.search')} accessibilityLabel={t('send.search')} placeholderTextColor={colors.muted} style={s.searchInput} autoCapitalize="none" autoCorrect={false} selectionColor={colors.cerise} />
      </View>

      <FlatList
        data={friends === null ? [] : rows}
        // lien privé et story en tête, pour tous : c'est par là qu'on fait venir quelqu'un qui n'a pas l'app
        ListHeaderComponent={friends !== null ? <View style={{ gap: 10, paddingBottom: hasFriends ? 18 : 10 }}>{linksBlock}</View> : null}
        keyExtractor={(r) => r.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
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
        renderItem={({ item: r, index }) => {
          if (r.kind === 'label') return <SectionLabel style={{ marginTop: index ? 14 : 0, marginBottom: 2 }}>{r.text}</SectionLabel>;
          const item = r.f;
          const on = selected.has(item.id);
          const st = streaks.get(item.id);
          return (
            <Animated.View entering={FadeInDown.springify().delay(Math.min(index, 10) * 30)}>
              <Row
                onPress={() => toggle(item.id)}
                active={on}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={st?.at_risk ? t('streak.atRisk', { n: st.days, name: item.username }) : item.username}
                style={[s.row, st?.at_risk && { backgroundColor: colors.riskBg }, on && !st?.at_risk && { backgroundColor: colors.card }]}
              >
                <Avatar name={item.username} uri={item.avatar_url} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.username}</Text>
                  {st?.at_risk ? <Text style={s.risk}>{t('contacts.atRiskSub')}</Text> : null}
                </View>
                {st && st.days > 0 ? <StreakNum days={st.days} atRisk={st.at_risk} /> : null}
                <Check on={on} />
              </Row>
            </Animated.View>
          );
        }}
        ListFooterComponent={
          <View style={{ gap: 10, paddingTop: 18 }}>
            <Pressable style={s.invite} onPress={invite} accessibilityRole="button">
              <Icon name="message" size={18} color={colors.ink} />
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
            {failure.retryable && <Button size="sm" label={t('common.retry')} onPress={send} />}
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
          line={sent.to}
          askText={sent.askText}
          sweet={sent.sweet}
          streak={sent.streak}
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

const s = StyleSheet.create({
  thumb: { width: 40, height: 52, borderRadius: 10, transform: [{ rotate: '6deg' }], borderWidth: 2, borderColor: colors.white },
  title: { paddingHorizontal: 20, marginTop: 2, marginBottom: 12 },
  row: { marginHorizontal: 0, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'transparent' },
  search: { marginHorizontal: 20, marginTop: 4, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
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
  inviteT: { ...tx.black, fontSize: 15, color: colors.ink },
  ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 10 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sand, overflow: 'hidden', marginHorizontal: 8 },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.cerise },
  fail: { position: 'absolute', left: 20, right: 24 },
  failIn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  failT: { ...tx.black, fontSize: 15, color: colors.vanille },
  failB: { ...tx.text, fontSize: 13, color: colors.mutedOnDark, marginTop: 2 },
});
