import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { t } from '../i18n';
import { colors, fonts, tx } from '../theme';
import { Confetti } from './Confetti';
import { Fondue } from './Fondue';
import { Button, Chip, Pop } from './ui';

/** Paliers de série fêtés à part. */
export const STREAK_MILESTONES = [7, 30, 100, 365];

type Props = {
  to: string;
  sweet?: boolean;
  streak?: number;
  /** Proposer les notifications (jamais demandées) : « sois prévenu quand il le gratte ». */
  ask?: { onAllow: () => void; onLater: () => void };
};

/** Moment de célébration après l'envoi : la glace tombe, les confettis partent, « envoyé. ». */
export function SentCelebration({ to, sweet, streak, ask }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const milestone = !!streak && STREAK_MILESTONES.includes(streak);
  return (
    <Animated.View entering={FadeIn.duration(160)} style={StyleSheet.absoluteFill} accessibilityLiveRegion="assertive" accessibilityLabel={`${t('send.sent')} ${t('send.sentTo', { to })}`}>
      <View style={[StyleSheet.absoluteFill, s.center, { backgroundColor: colors.coeur }]}>
        <Animated.View entering={ZoomIn.springify().damping(9).stiffness(160)}>
          <Fondue mood="party" size={170} bg={colors.coeur} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(160).springify()} style={s.title}>
          {t('send.sent')}
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <Text style={s.sub}>{t('send.sentTo', { to })}</Text>
        </Animated.View>
        <View style={s.chips}>
          {!!streak && streak >= 2 && (
            <Animated.View entering={ZoomIn.delay(340).springify().damping(10)}>
              <Chip label={milestone ? t('streak.milestone', { n: streak }) : t('send.streak', { n: streak })} tone="pistache" icon="scoop" />
            </Animated.View>
          )}
          {sweet && (
            <Animated.View entering={ZoomIn.delay(420).springify().damping(10)}>
              <Chip label={t('inbox.sweet')} tone="holo" icon="sparkle" />
            </Animated.View>
          )}
        </View>
      </View>
      <Confetti width={width} height={height} originY={0.36} />
      {ask && (
        <Animated.View entering={FadeInDown.delay(700).springify()} style={[s.ask, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Pop radius={24} style={s.askCard}>
            <Text style={s.askT}>{t('notif.ask', { to })}</Text>
            <Button label={t('notif.allow')} size="md" icon="message" onPress={ask.onAllow} />
            <Pressable onPress={ask.onLater} accessibilityRole="button" hitSlop={8} style={s.later}>
              <Text style={s.laterT}>{t('notif.later')}</Text>
            </Pressable>
          </Pop>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 28 },
  title: { fontFamily: fonts.displayHeavy, includeFontPadding: false, fontSize: 50, lineHeight: 54, color: colors.white },
  sub: { ...tx.black, fontSize: 17, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  chips: { flexDirection: 'row', gap: 10, marginTop: 8 },
  ask: { position: 'absolute', left: 20, right: 20 },
  askCard: { padding: 18, gap: 12 },
  askT: { ...tx.black, fontSize: 17, lineHeight: 22, color: colors.ink, textAlign: 'center' },
  later: { alignSelf: 'center', paddingVertical: 4 },
  laterT: { ...tx.bold, fontSize: 14, color: colors.muted },
});
