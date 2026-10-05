import { Link, router, useFocusEffect } from 'expo-router';
import { Fondue } from '../../components/Fondue';
import { useCallback, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { Bounce } from '../../components/Bounce';
import { Icon } from '../../components/Icon';
import { NativeMenu, type MenuItem } from '../../components/NativeMenu';
import { reactionKey, ReactionFace } from '../../components/Reactions';
import { Shimmer } from '../../components/Shimmer';
import { useToast } from '../../components/Toast';
import { Avatar, Button, Empty, HoloFill, Row, Screen, SectionLabel, Title, TopBar } from '../../components/ui';
import { t } from '../../i18n';
import { listLinks, listSent, report, type InboxItem, type SentItem, type SentLink } from '../../lib/api';
import { track } from '../../lib/monitoring';
import { ago, expireIn, seconds } from '../../lib/format';
import { shareInviteLink } from '../../lib/invite';
import { previewUri } from '../../lib/preview';
import { thumbhashOf } from '../../lib/thumb';
import { Image as ExpoImage } from 'expo-image';
import { useSession } from '../../lib/session';
import { useInbox } from '../../lib/useInbox';
import { tx, useStyles, useTheme, type Palette } from '../../theme';

/** Boîte : les flips à gratter en cartes holo, puis le suivi de ce qu'on a envoyé. */
export default function Inbox() {
  const { colors } = useTheme();
  const s = useStyles(themed);
  const { items, loading, refresh } = useInbox();
  const { profile } = useSession();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [sent, setSent] = useState<SentItem[]>([]);
  const [links, setLinks] = useState<SentLink[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // chaque flip est un objet à part entière : une grande carte par ligne, pas une mosaïque
  const cardW = width - 40;

  /** Appui long sur une carte : ouvrir le flip ou signaler son expéditeur (web : rien, le tap suffit). */
  const cardMenu = (it: InboxItem): MenuItem[] => [
    { id: 'open', title: t('inbox.openMenu'), sf: 'hand.draw' },
    { id: 'report', title: t('contacts.report'), sf: 'exclamationmark.bubble', destructive: true },
  ];
  const onCardAction = (it: InboxItem, id: string) => {
    track('inbox_menu_used', { action: id });
    if (id === 'open') return router.push(`/read/${it.flip_id}`);
    if (id === 'report') return report({ user_id: it.sender.id, reason: 'Profil signalé' }).then(() => toast(t('read.reported'))).catch((e) => toast((e as Error).message));
  };

  const loadSent = useCallback(() => {
    listSent().then(setSent).catch(() => {});
    return listLinks().then(setLinks).catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      loadSent();
    }, [loadSent]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadSent()]);
    setRefreshing(false);
  };

  return (
    <Screen>
      <TopBar />
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cerise} />}>
        <View style={s.titleRow}>
          <Title size={44}>{t('inbox.title')}</Title>
          {items.length > 0 && (
            <Animated.View key={items.length} entering={ZoomIn.springify().damping(9)}>
              <View style={s.count}>
                <Text style={s.countT}>{items.length}</Text>
              </View>
            </Animated.View>
          )}
        </View>

        {loading && items.length === 0 ? (
          <View style={s.grid}>
            {[0, 1].map((i) => (
              <Shimmer key={i} style={{ width: cardW, height: cardW * 0.74, borderRadius: 26 }} />
            ))}
          </View>
        ) : items.length === 0 ? (
          <Animated.View entering={FadeInDown.springify()}>
            <Empty
              art={<Fondue mood="wait" size={130} />}
              title={t('inbox.emptyTitle')}
              body={t('inbox.emptyBody')}
              action={
                <View style={{ gap: 12, marginTop: 8, alignItems: 'center' }}>
                  <Button label={t('inbox.emptyCta2')} icon="snap" tone="cerise" size="md" onPress={() => router.navigate('/camera')} />
                  {profile?.username ? <Button label={t('inbox.emptyCta')} icon="share" tone="white" size="md" onPress={() => shareInviteLink(profile.username)} /> : null}
                </View>
              }
            />
          </Animated.View>
        ) : (
          <View style={s.grid}>
            {items.map((it, i) => {
              const card = (
                <Link href={`/read/${it.flip_id}`} asChild>
                  <Bounce scaleTo={0.97} accessibilityRole="button" accessibilityLabel={t('inbox.open', { name: it.sender.username, ago: ago(it.created_at) })}>
                    <Link.AppleZoom>
                      <View style={StyleSheet.flatten([s.card, { width: cardW, height: cardW * 0.74 }])}>
                        {/* la vraie photo, floutée : chaque secret a sa couleur, rien n'est lisible */}
                        {it.preview ? <ExpoImage placeholder={thumbhashOf(it.preview) ? { thumbhash: thumbhashOf(it.preview)! } : { uri: previewUri(it.preview) }} placeholderContentFit="cover" blurRadius={thumbhashOf(it.preview) ? 0 : 14} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors /> : null}
                        <HoloFill style={[StyleSheet.absoluteFill, { opacity: it.preview ? 0.16 : 1 }]} />
                        <LinearGradient colors={['rgba(26,10,14,0)', 'rgba(26,10,14,0.62)']} style={s.cardScrim} pointerEvents="none" />
                        {it.mode === 'once' && (
                          <View style={s.once}>
                            <Text style={s.onceT}>{t('inbox.oncePass')}</Text>
                          </View>
                        )}
                        <View style={s.dot} />
                        <View style={s.meta}>
                          <Avatar name={it.sender.username} uri={it.sender.avatar_url} size={32} ring />
                          <View style={{ flex: 1 }}>
                            <Text style={s.name} numberOfLines={1}>
                              {it.sender.username}
                            </Text>
                            {/* le compte à rebours rend l'éphémère tangible : l'urgence douce de BeReal */}
                            <Text style={s.time} numberOfLines={1}>
                              {ago(it.created_at)} · {t('inbox.expires', { in: expireIn(it.expires_at) })}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </Link.AppleZoom>
                  </Bounce>
                </Link>
              );
              return (
                <Animated.View key={it.flip_id} entering={FadeInDown.springify().damping(16).delay(i * 50)} layout={LinearTransition.springify()}>
                  {Platform.OS === 'web' ? card : <NativeMenu title={`@${it.sender.username}`} items={cardMenu(it)} onSelect={(id) => onCardAction(it, id)} longPress>{card}</NativeMenu>}
                </Animated.View>
              );
            })}
            {/* rien d'autre à voir : on le dit, au lieu de laisser scroll dans le vide */}
            <Text style={s.caughtUp}>{t('inbox.caughtUp')}</Text>
          </View>
        )}

        {links.length + sent.length > 0 && <SectionLabel style={{ marginTop: 26, marginBottom: 10 }}>{t('inbox.sent')}</SectionLabel>}
        <View style={{ gap: 8 }}>
          {links.map((l, i) => (
            <Animated.View key={l.token} entering={FadeInDown.springify().delay(100 + i * 30)}>
              <Row>
                <View style={s.ic}>
                  <Icon name={l.kind === 'story' ? 'story' : 'link'} size={18} color={colors.ink} />
                </View>
                <Text style={s.rowName}>{l.kind === 'story' ? t('link.sentStory') : t('link.sentPrivate')}</Text>
                <Status
                  on={!!l.scratched_at || l.kind === 'story'}
                  label={l.kind === 'story' ? t('link.storyStats', { o: l.opens, s: l.scratches }) : l.scratched_at ? t('inbox.scratched', { p: l.percent ?? 0, s: seconds(l.duration_ms) }) : l.opened_at ? t('link.opened') : t('link.waiting')}
                />
              </Row>
            </Animated.View>
          ))}
          {sent.map((x, i) => (
            <Animated.View key={`${x.flip_id}-${x.recipient.id}`} entering={FadeInDown.springify().delay(120 + i * 30)}>
              <Row>
                <Avatar name={x.recipient.username} uri={x.recipient.avatar_url} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.rowName}>{x.recipient.username}</Text>
                    {/* la réaction rejoue pour l'expéditeur : elle pop, elle n'est pas qu'une vignette */}
                    {reactionKey(x.reaction) ? (
                      <Animated.View entering={ZoomIn.springify().damping(9).delay(200)}>
                        <ReactionFace kind={reactionKey(x.reaction)!} size={20} />
                      </Animated.View>
                    ) : null}
                  </View>
                  {x.screenshot_at && (
                    <View style={s.snap} accessibilityLabel={t('inbox.screenshot')}>
                      <Fondue mood="shock" size={18} />
                      <Text style={s.snapT}>{t('inbox.screenshot')}</Text>
                    </View>
                  )}
                </View>
                <Status on={!!x.scratched_at} label={x.scratched_at ? t('inbox.scratched', { p: x.percent ?? 0, s: seconds(x.duration_ms) }) : t('inbox.notYet')} />
              </Row>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Statut d'un envoi : pastille pistache « vu » quand c'est gratté, texte discret sinon. */
function Status({ on, label }: { on: boolean; label: string }) {
  const s = useStyles(themed);
  if (!on) return <Text style={s.rowMeta}>{label}</Text>;
  return (
    <View style={s.seen}>
      <Icon name="eye" size={13} stroke={2.6} />
      <Text style={s.seenT} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const themed = (colors: Palette) =>
  StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 150 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 16 },
  grid: { gap: 18 },
  caughtUp: { ...tx.bold, fontSize: 13, color: colors.muted, textAlign: 'center', paddingTop: 6, paddingBottom: 14 },
  count: { minWidth: 30, height: 30, paddingHorizontal: 9, borderRadius: 15, backgroundColor: colors.cerise, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  countT: { ...tx.black, fontSize: 15, color: colors.white },
  card: { borderRadius: 24, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  cardScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  once: { position: 'absolute', top: 10, left: 10, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.38)' },
  onceT: { ...tx.bold, fontSize: 11, color: colors.white },
  meta: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { ...tx.black, fontSize: 15, color: colors.vanille },
  time: { ...tx.text, fontSize: 12, color: colors.mutedOnDark },
  dot: { position: 'absolute', top: 12, right: 12, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.cerise, borderWidth: 2, borderColor: colors.white },
  ic: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  rowName: { flex: 1, ...tx.bold, fontSize: 15, color: colors.ink },
  rowMeta: { flexShrink: 1, textAlign: 'right', ...tx.text, fontSize: 12.5, color: colors.muted },
  seen: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: colors.okBg },
  seenT: { flexShrink: 1, ...tx.black, fontSize: 11.5, color: colors.ink },
  snap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  snapT: { ...tx.bold, fontSize: 11.5, color: colors.ceriseDeep },
});
