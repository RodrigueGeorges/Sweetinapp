import NetInfo from '@react-native-community/netinfo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Bounce } from '../../components/Bounce';
import { Fondue } from '../../components/Fondue';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { reactionKey, ReactionFace } from '../../components/Reactions';
import { Shimmer } from '../../components/Shimmer';
import { Shutter } from '../../components/Shutter';
import { SentThumb, SweetCard } from '../../components/SweetCard';
import { Avatar, Button, Empty, Screen } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { t } from '../../i18n';
import { listFriends, listLinks, listSent, myStreaks, type Profile, type SentItem, type SentLink, type Streak } from '../../lib/api';
import { draft } from '../../lib/draft';
import { ago, agoShort, seconds } from '../../lib/format';
import { shareInviteLink } from '../../lib/invite';
import { useSession } from '../../lib/session';
import { onQueueChange, pendingSends, removeQueuedAt, type QueuedSend } from '../../lib/sendQueue';
import { useInbox } from '../../lib/useInbox';
import { useWelcome, welcomeItem } from '../../lib/welcome';
import { useSweetHour } from '../../lib/useSweetHour';
import { useTilt } from '../../lib/useTilt';
import { rememberOrigin } from '../../lib/origin';
import { colors, fonts, isDark, tx } from '../../theme';

const SWEET_HOUR_S = 3600;

/**
 * La vitrine (DA Fondant), l'accueil de l'app façon BeReal : barre du haut en verre (amis, logo, profil),
 * reçus / envoyés, bandeau « ton tour » ou sweet hour, une grande carte puis la grille, et le déclencheur en bas.
 */
export default function Inbox() {
  const { items: received, loading, error, refresh } = useInbox();
  // rien reçu encore : le sweet de bienvenue « de sweetin » à gratter tout de suite
  const welcome = useWelcome();
  const items = useMemo(() => (received.length === 0 && welcome && !loading ? [welcomeItem()] : received), [received, welcome, loading]);
  const { profile } = useSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tilt = useTilt(); // une seule lecture du gyroscope pour toutes les cartes
  const sweet = useSweetHour();
  const [tab, setTab] = useState<'in' | 'out'>('in');
  const [sent, setSent] = useState<SentItem[]>([]);
  const [links, setLinks] = useState<SentLink[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [streaks, setStreaks] = useState<Map<string, Streak>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [queued, setQueued] = useState<QueuedSend[]>([]);
  const [offline, setOffline] = useState(false);

  // la file d'envoi change quand un sweet part ou entre dedans
  useEffect(() => onQueueChange(() => pendingSends().then(setQueued)), []);
  // bandeau « pas de réseau » au-dessus des pastilles
  useEffect(() => {
    const sync = (s: { isConnected: boolean | null; isInternetReachable: boolean | null }) => setOffline(s.isConnected === false || s.isInternetReachable === false);
    NetInfo.fetch().then(sync).catch(() => {});
    return NetInfo.addEventListener(sync);
  }, []);

  const [draftWaiting, setDraftWaiting] = useState(draft.pending && draft.deferred);

  // avatars en cache disque dès la vitrine : contacts et grille instantanés (les photos, non : URL signée à l'ouverture, jamais sur disque)
  useEffect(() => {
    const urls = [...friends.map((f) => f.avatar_url), ...items.map((i) => i.sender.avatar_url)].filter((u): u is string => !!u);
    if (urls.length) Image.prefetch(urls).catch(() => {});
  }, [friends, items]);

  const load = useCallback(() => {
    setDraftWaiting(draft.pending && draft.deferred);
    pendingSends().then(setQueued).catch(() => {});
    listFriends().then(setFriends).catch(() => {});
    myStreaks().then(setStreaks).catch(() => {});
    listSent().then(setSent).catch(() => {});
    return listLinks().then(setLinks).catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), load()]);
    setRefreshing(false);
  };

  // « ton tour » : l'ami dont la série va fondre, la plus longue d'abord
  const turn = useMemo(() => {
    const risk = friends.filter((f) => streaks.get(f.id)?.at_risk).sort((a, b) => (streaks.get(b.id)?.days ?? 0) - (streaks.get(a.id)?.days ?? 0));
    return risk[0] ? { friend: risk[0], days: streaks.get(risk[0].id)!.days, others: risk.length - 1 } : null;
  }, [friends, streaks]);

  const shoot = () => router.push('/camera');
  const sendTo = (f: Profile) => {
    draft.reset();
    draft.replyTo = f.id;
    draft.replyName = f.username;
    router.push('/camera');
  };

  const pad = 16;
  const heroW = width - pad * 2;
  const heroH = Math.round(heroW * 0.94);
  const cellW = (width - pad * 2 - 12) / 2;
  const cellH = Math.round(cellW * 1.33);
  const [hero, ...rest] = items;

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }}>
        <View style={s.top}>
          <GlassButton label={t('tabs.contacts')} onPress={() => router.push('/contacts')}>
            <Icon name="users" size={24} color={colors.ink} stroke={2.25} />
          </GlassButton>
          <View style={{ marginTop: 4 }}>
            <Logo size={24} color={colors.ink} />
          </View>
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel={t('inbox.profile')} hitSlop={8} style={s.me}>
            {profile ? <Avatar name={profile.username} uri={profile.avatar_url} size={34} /> : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 170 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
        showsVerticalScrollIndicator={false}
      >
        {offline && (
          <Animated.View entering={FadeInDown.springify()} accessibilityLiveRegion="polite">
            <Pressable onPress={onRefresh} accessibilityRole="button" accessibilityLabel={`${t('common.offline')} ${t('common.retry')}`} hitSlop={8} style={s.offline}>
              <Icon name="hourglass" size={13} color={colors.cacao} stroke={2.6} />
              <Text style={s.offlineT}>{t('common.offline')}</Text>
              <Icon name="retake" size={13} color={colors.cacao} stroke={2.6} />
            </Pressable>
          </Animated.View>
        )}
        <View style={s.pills} accessibilityRole="tablist">
          <Pill on={tab === 'in'} label={t('inbox.received')} count={received.length} onPress={() => setTab('in')} />
          <Pill on={tab === 'out'} label={t('inbox.sent')} onPress={() => setTab('out')} />
        </View>

        {/* brouillon remis à plus tard : on le propose sans forcer */}
        {draftWaiting ? (
          <Animated.View entering={FadeInDown.springify()}>
            <Bounce
              onPress={() => router.push('/sendto')}
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel={t('inbox.draftWait')}
              style={[s.banner, { backgroundColor: isDark ? colors.card2 : colors.cacao }]}
            >
              <Image source={{ uri: draft.uri }} style={s.draftThumb} contentFit="cover" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.bannerTitle, { color: colors.white }]}>{t('inbox.draftWait')}</Text>
                <Text style={[s.bannerSub, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>
                  {draft.message}
                </Text>
              </View>
              <View style={s.turnGo}>
                <Icon name="arrow" size={20} color={colors.cacao} stroke={2.8} />
              </View>
            </Bounce>
          </Animated.View>
        ) : null}

        {sweet !== null ? (
          <Animated.View entering={FadeInDown.springify()}>
            <Bounce onPress={shoot} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`${t('sweet.title')}, ${clock(sweet)}`} style={[s.banner, { backgroundColor: colors.citron }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.bannerTitle}>{t('sweet.title')}</Text>
                <Text style={s.bannerSub} numberOfLines={1}>
                  {t('sweet.body')}
                </Text>
              </View>
              <Text style={s.bannerClock} allowFontScaling={false}>
                {clock(sweet)}
              </Text>
            </Bounce>
          </Animated.View>
        ) : turn ? (
          <Animated.View entering={FadeInDown.springify()}>
            <Bounce onPress={() => sendTo(turn.friend)} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`${t('inbox.yourTurn')}. ${t('inbox.waiting', { name: turn.friend.username, n: turn.days })}`} style={[s.banner, { backgroundColor: isDark ? colors.card2 : colors.cacao, paddingLeft: 10 }]}>
              <View style={s.turnAv}>
                <Svg width={56} height={56} viewBox="0 0 56 56" style={StyleSheet.absoluteFill}>
                  <Circle cx={28} cy={28} r={26} fill="none" stroke={colors.citron} strokeWidth={3} strokeDasharray="4 5" strokeLinecap="round" />
                </Svg>
                <Avatar name={turn.friend.username} uri={turn.friend.avatar_url} size={44} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.bannerTitle, { color: colors.white }]}>{t('inbox.yourTurn')}</Text>
                <Text style={[s.bannerSub, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>
                  {t('inbox.waiting', { name: turn.friend.username, n: turn.days })}
                </Text>
              </View>
              <View style={s.turnGo}>
                <Icon name="arrow" size={20} color={colors.cacao} stroke={2.8} />
              </View>
            </Bounce>
          </Animated.View>
        ) : null}

        {tab === 'in' ? (
          loading && items.length === 0 ? (
            <View style={{ gap: 12 }}>
              <Shimmer style={{ width: heroW, height: heroH, borderRadius: 28 }} />
              <View style={s.grid}>
                {[0, 1].map((i) => (
                  <Shimmer key={i} style={{ width: cellW, height: cellH, borderRadius: 26 }} />
                ))}
              </View>
            </View>
          ) : items.length === 0 ? (
            <Animated.View entering={FadeInDown.springify()}>
              {error && !offline ? (
                <Empty art={<Fondue mood="sad" size={130} />} title={t('common.loadFailed')} action={<Button label={t('common.retry')} icon="retake" size="md" onPress={onRefresh} />} />
              ) : (
              <Empty
                art={<Fondue mood={offline ? 'sad' : 'wait'} size={130} />}
                title={offline ? t('inbox.offlineTitle') : t('inbox.emptyTitle')}
                body={offline ? t('inbox.offlineBody') : t('inbox.emptyBody')}
                // le plus sûr moyen d'en recevoir un : en envoyer un. L'action principale ouvre l'appareil photo.
                action={
                  offline ? (
                    <Button label={t('common.retry')} icon="retake" size="md" onPress={onRefresh} />
                  ) : (
                    <View style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <Button label={t('inbox.emptyCta2')} icon="snap" size="md" haptic="medium" onPress={() => router.push('/camera')} />
                      {profile?.username ? <Button label={t('inbox.emptyCta')} icon="share" tone="white" size="sm" onPress={() => shareInviteLink(profile.username)} /> : null}
                    </View>
                  )
                }
              />
              )}
            </Animated.View>
          ) : (
            <View style={{ gap: 14 }}>
              <Animated.View entering={FadeInDown.springify().damping(16)} layout={LinearTransition.springify()}>
                <Link href={`/read/${hero.flip_id}`} asChild>
                  <Bounce scaleTo={0.97} onPressIn={(e) => rememberOrigin(e.currentTarget as unknown as View, 28)} accessibilityRole="button" accessibilityLabel={t('inbox.open', { name: hero.sender.username, ago: ago(hero.created_at) })}>
                    <Link.AppleZoom>
                      <View>
                        <SweetCard item={hero} width={heroW} height={heroH} hero tilt={tilt} />
                      </View>
                    </Link.AppleZoom>
                  </Bounce>
                </Link>
              </Animated.View>
              <View style={s.grid}>
                {rest.map((it, i) => (
                  <Animated.View key={it.flip_id} entering={FadeInDown.springify().damping(16).delay(60 + i * 50)} layout={LinearTransition.springify()}>
                    <Link href={`/read/${it.flip_id}`} asChild>
                      <Bounce scaleTo={0.95} onPressIn={(e) => rememberOrigin(e.currentTarget as unknown as View, 26)} accessibilityRole="button" accessibilityLabel={t('inbox.open', { name: it.sender.username, ago: ago(it.created_at) })}>
                        <Link.AppleZoom>
                          <View>
                            <SweetCard item={it} width={cellW} height={cellH} tilt={i < 4 ? tilt : undefined} />
                          </View>
                        </Link.AppleZoom>
                      </Bounce>
                    </Link>
                  </Animated.View>
                ))}
              </View>
            </View>
          )
        ) : (
          <SentList sent={sent} links={links} queued={queued} friends={friends} />
        )}
      </ScrollView>

      {/* fondu du bas : la grille passe sous le déclencheur */}
      <View pointerEvents="none" style={[s.fade, { height: insets.bottom + 120 }]}>
        <LinearGradient colors={isDark ? ['rgba(14,11,12,0)', 'rgba(14,11,12,0.92)', colors.paper] : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', colors.paper]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <Animated.View entering={ZoomIn.springify().damping(12).delay(120)} style={[s.shutter, { bottom: insets.bottom + 18 }]}>
        <Shutter onPress={shoot} label={sweet !== null ? t('inbox.shootSweet', { t: clock(sweet) }) : t('inbox.shoot')} progress={sweet !== null ? sweet / SWEET_HOUR_S : null} />
      </Animated.View>
    </Screen>
  );
}

function clock(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Bouton rond en verre de la barre du haut (verre clair sur fond clair, transparent en sombre). */
function GlassButton({ children, label, onPress, dot }: { children: ReactNode; label: string; onPress: () => void; dot?: boolean }) {
  return (
    <Bounce onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.glassBtn}>
      {children}
      {dot ? <View style={s.glassDot} /> : null}
    </Bounce>
  );
}

/** Pastille reçus / envoyés. */
function Pill({ on, label, count, onPress }: { on: boolean; label: string; count?: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={count ? `${label}, ${count}` : label} style={[s.pill, on && { backgroundColor: isDark ? colors.white : colors.cacao }]}>
      <Text style={[s.pillT, { color: on ? (isDark ? colors.cacao : colors.white) : colors.muted }]}>{label}</Text>
      {count ? (
        <Animated.View key={count} entering={ZoomIn.springify().damping(9)} style={s.pillN}>
          <Text style={s.pillNT}>{count}</Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

/**
 * Ce qu'on a envoyé, en cartes : la vignette qui coule (fondue une fois lue), l'ami, et le statut en autocollants
 * (« lu en 4,5 s » citron, la réaction reçue, « capture tentée » framboise). C'est la récompense de celui qui envoie.
 */
function SentList({ sent, links, queued, friends }: { sent: SentItem[]; links: SentLink[]; queued: QueuedSend[]; friends: Profile[] }) {
  const toast = useToast();
  if (sent.length + links.length + queued.length === 0) {
    return (
      <Animated.View entering={FadeIn}>
        <Empty art={<Fondue mood="wait" size={110} />} title={t('inbox.sentEmpty')} body={t('inbox.sentEmptyBody')} />
      </Animated.View>
    );
  }
  const nameOf = (id: string) => friends.find((f) => f.id === id)?.username;
  return (
    <View style={{ gap: 4 }}>
      {queued.map((q, i) => {
        const names = q.recipients.map(nameOf).filter(Boolean).join(', ');
        return (
          <Animated.View key={`queue-${q.queued_at}`} entering={FadeInDown.springify()} style={s.sentRow}>
            <Pressable onLongPress={() => { removeQueuedAt(i).catch(() => {}); toast(t('queue.cancelled')); }} accessibilityRole="button" accessibilityHint={t('queue.cancelHint')} accessibilityLabel={names || t('queue.rowTitle')} style={s.queueRow}>
              <SentThumb preview={q.preview} melted={false} />
              <View style={s.sentMid}>
                <Text style={s.sentName} numberOfLines={1}>
                  {names || t('queue.rowTitle')}
                </Text>
                <Text style={s.sentAgo}>{t('queue.rowSub')}</Text>
              </View>
              <Icon name="hourglass" size={17} color={colors.muted} stroke={2.4} />
            </Pressable>
          </Animated.View>
        );
      })}
      {links.map((l, i) => {
        const story = l.kind === 'story';
        const label = story ? t('link.storyStats', { o: l.opens, s: l.scratches }) : l.scratched_at ? readLabel(l.duration_ms) : l.opened_at ? t('link.opened') : t('link.waiting');
        return (
          <Animated.View key={l.token} entering={FadeInDown.springify().delay(i * 30)} style={s.sentRow}>
            <View>
              <SentThumb preview={l.preview} melted={!story && !!l.scratched_at} />
              <View style={s.linkBadge}>
                <Icon name={story ? 'story' : 'link'} size={13} color={colors.cacao} stroke={2.6} />
              </View>
            </View>
            <View style={s.sentMid}>
              <Text style={s.sentName}>{story ? t('link.sentStory') : t('link.sentPrivate')}</Text>
              <Text style={s.sentAgo}>{agoShort(l.created_at)}</Text>
            </View>
            {story || l.scratched_at ? <Tag label={label} tone="citron" rot={-3} /> : <Text style={s.rowMeta}>{label}</Text>}
          </Animated.View>
        );
      })}
      {sent.map((x, i) => {
        const kind = reactionKey(x.reaction);
        return (
          <Animated.View key={`${x.flip_id}-${x.recipient.id}`} entering={FadeInDown.springify().delay(20 + i * 30)} style={s.sentRow}>
            <SentThumb preview={x.preview} melted={!!x.scratched_at} />
            <View style={s.sentMid}>
              <View style={s.sentWho}>
                <Avatar name={x.recipient.username} uri={x.recipient.avatar_url} size={22} />
                <Text style={s.sentName} numberOfLines={1}>
                  {x.recipient.username}
                </Text>
              </View>
              <Text style={s.sentAgo}>{agoShort(x.created_at)}</Text>
            </View>
            <View style={s.sentTags}>
              {x.scratched_at ? <Tag label={readLabel(x.duration_ms)} tone="citron" rot={-3} /> : <Text style={s.rowMeta}>{t('inbox.notYet')}</Text>}
              {kind ? <ReactionFace kind={kind} /> : null}
              {x.screenshot_at ? <Tag label={t('inbox.screenshot')} tone="cerise" rot={3} icon="snap" /> : null}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** « lu en 4,5 s », ou « lu sans gratter » quand c'est allé trop vite pour avoir gratté. */
function readLabel(ms: number | null) {
  return ms != null && ms < 500 ? t('inbox.readNoScratch') : t('inbox.scratched', { s: seconds(ms) });
}

/** Petit autocollant de statut : liseré blanc, posé de travers, texte nuit. */
function Tag({ label, tone, rot, icon }: { label: string; tone: 'citron' | 'cerise'; rot: number; icon?: 'snap' }) {
  return (
    <View style={[s.tag, { backgroundColor: tone === 'citron' ? colors.citron : colors.cerise, transform: [{ rotate: `${rot}deg` }] }]}>
      {icon ? <Icon name={icon} size={11} color={colors.cacao} stroke={2.8} /> : null}
      <Text style={s.tagT} numberOfLines={1} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  top: { height: 52, marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'transparent' : 'rgba(255,255,255,0.75)',
    ...(isDark ? {} : { shadowColor: '#160F12', shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(22,15,18,0.1)' }),
  },
  glassDot: { position: 'absolute', top: 8, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.cerise, borderWidth: 2, borderColor: colors.paper },
  me: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, gap: 14 },
  pills: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillT: { ...tx.bold, fontSize: 15 },
  pillN: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.cerise, alignItems: 'center', justifyContent: 'center' },
  pillNT: { ...tx.black, fontSize: 12, color: colors.cacao },
  banner: { minHeight: 76, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  draftThumb: { width: 40, height: 52, borderRadius: 10, transform: [{ rotate: '-4deg' }], borderWidth: 2, borderColor: colors.white },
  bannerTitle: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 20, lineHeight: 22, color: colors.cacao },
  bannerSub: { marginTop: 3, ...tx.bold, fontSize: 13, lineHeight: 18, color: colors.cacao },
  bannerClock: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 26, color: colors.cacao },
  turnAv: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  turnGo: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.citron, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 14 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  shutter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  queueRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  offline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'center', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.citron },
  offlineT: { ...tx.black, fontSize: 13, color: colors.cacao },
  linkBadge: { position: 'absolute', right: -6, top: -6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.citron, borderWidth: 2, borderColor: colors.paper },
  sentMid: { flex: 1, minWidth: 0, gap: 4 },
  sentWho: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sentName: { flexShrink: 1, ...tx.black, fontSize: 16, color: colors.ink },
  sentAgo: { ...tx.bold, fontSize: 12.5, color: colors.muted },
  sentTags: { alignItems: 'flex-end', gap: 6, maxWidth: '52%' },
  rowMeta: { flexShrink: 1, textAlign: 'right', ...tx.bold, fontSize: 13, color: colors.muted },
  tag: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, borderWidth: 2, borderColor: colors.white, shadowColor: '#160F12', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tagT: { flexShrink: 1, fontFamily: fonts.display, includeFontPadding: false, fontSize: 11, color: colors.cacao },
});
