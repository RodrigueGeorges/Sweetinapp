import * as Haptics from 'expo-haptics';
import { Fondue } from '../../components/Fondue';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bounce } from '../../components/Bounce';
import { Rolling } from '../../components/Rolling';
import { Icon, type IconName } from '../../components/Icon';
import { Shimmer } from '../../components/Shimmer';
import { Mark } from '../../components/Logo';
import { NativeMenu, type MenuItem } from '../../components/NativeMenu';
import { useToast } from '../../components/Toast';
import { Avatar, Button, Empty, IconButton, Pop, Row, Screen, SectionLabel, StreakNum, Title, Header } from '../../components/ui';
import { t } from '../../i18n';
import { addFriend, blockUser, report, listFriends, myLostStreaks, myStreaks, removeFriend, restoreStreak, type LostStreak, type Profile, type Streak } from '../../lib/api';
import { draft } from '../../lib/draft';
import { shareInviteLink } from '../../lib/invite';
import { track } from '../../lib/monitoring';
import { play } from '../../lib/sounds';
import { useSession } from '../../lib/session';
import { colors, fonts, tx } from '../../theme';

/** Tes potes : la plus longue série en vedette, les séries en danger en tête avec « flip ! », puis tout le monde. */
export default function Contacts() {
  const toast = useToast();
  const { profile } = useSession();
  const me = profile?.username ?? '';
  const [friends, setFriends] = useState<Profile[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [streaks, setStreaks] = useState<Map<string, Streak>>(new Map());
  const [lost, setLost] = useState<LostStreak[]>([]);

  const load = useCallback(() => {
    listFriends().then(setFriends).catch(() => setFriends([]));
    myStreaks().then(setStreaks).catch(() => {});
    myLostStreaks().then(setLost).catch(() => {});
  }, []);

  const relight = async (l: LostStreak) => {
    try {
      await restoreStreak(l.friend_id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      play('streak');
      toast(t('streak.saved'));
      track('streak_saved', { days: l.days });
      load();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { best, atRisk, others } = useMemo(() => {
    const list = friends ?? [];
    const days = (f: Profile) => streaks.get(f.id)?.days ?? 0;
    const risk = list.filter((f) => streaks.get(f.id)?.at_risk).sort((a, b) => days(b) - days(a));
    const rest = list.filter((f) => !streaks.get(f.id)?.at_risk).sort((a, b) => days(b) - days(a) || a.username.localeCompare(b.username));
    const top = [...list].sort((a, b) => days(b) - days(a))[0];
    return { best: top && days(top) > 0 ? { friend: top, days: days(top) } : null, atRisk: risk, others: rest };
  }, [friends, streaks]);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const p = await addFriend(name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(t('contacts.added', { name: p.username }));
      track('friend_added');
      setName('');
      setAdding(false);
      load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const flipTo = (f: Profile) => {
    draft.reset();
    draft.replyTo = f.id;
    draft.replyName = f.username;
    router.navigate('/camera');
  };

  /** Actions sur un ami, dans le menu natif du « … ». */
  const friendItems = (f: Profile): MenuItem[] => [
    { id: 'flip', title: t('contacts.sendFlip'), sf: 'camera' },
    { id: 'remove', title: t('contacts.remove'), sf: 'person.badge.minus' },
    { id: 'report', title: t('contacts.report'), sf: 'exclamationmark.bubble', destructive: true },
    { id: 'block', title: t('contacts.block'), sf: 'hand.raised', destructive: true },
  ];
  const onFriendAction = (f: Profile, id: string) => {
    if (id === 'flip') return flipTo(f);
    if (id === 'remove') return removeFriend(f.id).then(load);
    if (id === 'report')
      return report({ user_id: f.id, reason: 'Profil signalé' })
        .then(() => {
          toast(t('read.reported'));
          load();
        })
        .catch((e) => toast((e as Error).message));
    if (id === 'block')
      return blockUser(f.id).then(() => {
        toast(t('contacts.blocked', { name: f.username }));
        load();
      });
  };

  const header = (
    <View style={{ gap: 16, paddingBottom: 12 }}>
      <Title size={44}>{t('contacts.title')}</Title>

      {adding && (
        <Animated.View entering={FadeInDown.springify()} style={s.addRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('contacts.addPlaceholder')}
            placeholderTextColor={colors.placeholder}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={add}
            returnKeyType="done"
            selectionColor={colors.ink}
            style={s.addInput}
            accessibilityLabel={t('contacts.addPlaceholder')}
          />
          <Button label={t('contacts.addBtn')} size="md" tone="cacao" loading={busy} disabled={!name.trim()} onPress={add} />
        </Animated.View>
      )}

      {best ? (
        <Bounce onPress={() => flipTo(best.friend)} accessibilityRole="button" accessibilityLabel={`${t('streak.days', { n: best.days })} ${t('contacts.with', { name: best.friend.username })}. ${t('contacts.sendFlip')}`} haptic="light" scaleTo={0.97}>
        <Pop bg={colors.coeur} radius={28} borderWidth={0} style={s.hero}>
          <View style={s.heroBadge}>
            <Mark size={34} cone={colors.cacao} />
          </View>
          <View style={{ flex: 1 }}>
            {/* la série monte jusqu'à son total à l'ouverture */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessible accessibilityLabel={t('streak.days', { n: best.days })}>
              {t('streak.days', { n: '\u0000' }).split('\u0000').map((part, i) =>
                i === 0 ? (
                  <Text key={i} style={s.heroDays} allowFontScaling={false}>
                    {part}
                  </Text>
                ) : (
                  <View key={i} style={{ flexDirection: 'row' }}>
                    <Rolling value={best.days} from={0} style={s.heroDays} lineHeight={34} />
                    <Text style={s.heroDays} allowFontScaling={false}>
                      {part}
                    </Text>
                  </View>
                ),
              )}
            </View>
            <Text style={s.heroSub} numberOfLines={2}>
              {t('contacts.with', { name: `@${best.friend.username}` })} · {t('contacts.best')}
            </Text>
          </View>
          <View style={s.heroGo}>
            <Icon name="snap" size={22} color={colors.cacao} />
          </View>
        </Pop>
        </Bounce>
      ) : friends && friends.length > 0 ? (
        <Pop radius={20} style={s.tip}>
          <Icon name="scoop" size={24} color={colors.ceriseText} />
          <Text style={s.tipT}>{t('contacts.noStreak')}</Text>
        </Pop>
      ) : null}

      <View style={s.tiles}>
        <Tile icon="share" label={t('contacts.shareLink')} onPress={() => me && shareInviteLink(me)} />
        <Tile icon="users" label={t('contacts.find')} onPress={() => router.push({ pathname: '/friends-setup', params: { from: 'contacts' } })} />
        <Tile icon="scan" label={t('friends.scan')} onPress={() => router.push('/scan')} />
      </View>

      {lost.map((l) => {
        const f = friends?.find((x) => x.id === l.friend_id);
        if (!f) return null;
        return (
          <Row key={`lost-${f.id}`} style={s.lost}>
            <Avatar name={f.username} uri={f.avatar_url} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{f.username}</Text>
              <Text style={s.lostSub}>{l.can_save ? `${t('streak.lost', { n: l.days })} · ${t('streak.saveHint')}` : t('streak.lost', { n: l.days })}</Text>
            </View>
            {l.can_save ? <Button label={t('streak.save')} size="sm" tone="cacao" icon="scoop" onPress={() => relight(l)} /> : null}
          </Row>
        );
      })}

      {atRisk.length > 0 && (
        <View style={{ gap: 8 }}>
          {atRisk.map((f) => {
            const st = streaks.get(f.id)!;
            return (
              <Row key={f.id} style={s.risk}>
                <Avatar name={f.username} uri={f.avatar_url} size={46} />
                <View style={{ flex: 1 }} accessible accessibilityLabel={t('streak.atRisk', { n: st.days, name: f.username })}>
                  <Text style={s.name}>
                    {f.username} · {t('contacts.daysShort', { n: st.days })}
                  </Text>
                  <Text style={s.riskSub}>{t('contacts.atRiskSub')}</Text>
                </View>
                <Button label={t('contacts.flipNow')} size="sm" tone="cerise" icon="snap" onPress={() => flipTo(f)} />
              </Row>
            );
          })}
        </View>
      )}

      {others.length > 0 && <SectionLabel style={{ marginTop: 4 }}>{t('send.friends')}</SectionLabel>}
    </View>
  );

  return (
    <Screen>
      <Header
        back
        right={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <IconButton icon="userPlus" label={t('contacts.add')} onPress={() => setAdding((a) => !a)} />
            <IconButton icon="settings" label={t('contacts.settings')} onPress={() => router.push('/settings')} />
          </View>
        }
      />
      <FlatList
        data={others}
        keyExtractor={(f) => f.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          friends === null ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <Shimmer key={i} style={{ height: 60, borderRadius: 18 }} />
              ))}
            </View>
          ) : atRisk.length === 0 ? (
            <Empty art={<Fondue mood="happy" size={120} />} title={t('contacts.emptyTitle')} body={t('contacts.empty')} />
          ) : null
        }
        renderItem={({ item, index }) => {
          const st = streaks.get(item.id);
          return (
            <Animated.View entering={FadeInDown.springify().delay(Math.min(index, 10) * 30)}>
              <Row style={{ marginHorizontal: 0, paddingHorizontal: 4 }}>
                {/* toucher la ligne : envoyer un flip ; le « … » ouvre le menu natif (pas de bouton dans un bouton) */}
                <Pressable onPress={() => flipTo(item)} accessibilityRole="button" accessibilityLabel={`${item.username}. ${t('contacts.sendFlip')}`} style={({ pressed }) => [s.rowMain, pressed && { opacity: 0.7 }]}>
                  <Avatar name={item.username} uri={item.avatar_url} size={46} />
                  <Text style={[s.name, { flex: 1 }]}>{item.username}</Text>
                  {st && st.days > 0 ? <StreakNum days={st.days} size={22} /> : null}
                </Pressable>
                <NativeMenu title={item.username} items={friendItems(item)} onSelect={(id) => onFriendAction(item, id)} label={t('read.more')}>
                  <View style={s.moreBtn}>
                    <Icon name="more" size={18} color={colors.muted} />
                  </View>
                </NativeMenu>
              </Row>
            </Animated.View>
          );
        }}
      />
    </Screen>
  );
}

function Tile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Bounce onPress={onPress} style={s.tile} accessibilityRole="button" accessibilityLabel={label} haptic="light" scaleTo={0.95}>
      <Icon name={icon} size={18} />
      <Text style={s.tileT} numberOfLines={1}>
        {label}
      </Text>
    </Bounce>
  );
}

const s = StyleSheet.create({
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  moreBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, // 48 dp : cible tactile Android
  heroGo: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cerise, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 150 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addInput: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 16, ...tx.bold, fontSize: 15, color: colors.ink },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16, overflow: 'hidden' },
  heroBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  heroDays: { fontFamily: fonts.displayHeavy, includeFontPadding: false, fontSize: 30, lineHeight: 34, color: colors.citron },
  heroSub: { ...tx.bold, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tipT: { flex: 1, ...tx.bold, fontSize: 14, lineHeight: 19, color: colors.ink },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  tileT: { ...tx.bold, fontSize: 13.5, color: colors.ink, flexShrink: 1 },
  risk: { backgroundColor: colors.riskBg, paddingVertical: 10 },
  lost: { backgroundColor: colors.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.dashed, paddingVertical: 10 },
  lostSub: { ...tx.bold, fontSize: 12.5, color: colors.muted },
  riskSub: { ...tx.bold, fontSize: 12.5, color: colors.ceriseDeep },
  name: { ...tx.black, fontSize: 16.5, color: colors.ink },
});
