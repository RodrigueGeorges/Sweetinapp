import type { SkImage } from '@shopify/react-native-skia';
import * as Clipboard from 'expo-clipboard';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fondue } from '../../components/Fondue';
import { Icon } from '../../components/Icon';
import { ScratchCard } from '../../components/ScratchCard';
import { Shimmer } from '../../components/Shimmer';
import { useToast } from '../../components/Toast';
import { BackButton, Button, Screen, Title } from '../../components/ui';
import { t, humanError } from '../../i18n';
import { openMine, type MineFlip } from '../../lib/api';
import { loadImageInMemory } from '../../lib/image';
import { track } from '../../lib/monitoring';
import { agoShort, seconds } from '../../lib/format';
import { useTilt } from '../../lib/useTilt';
import { colors, tx } from '../../theme';

const LINK_BASE = process.env.EXPO_PUBLIC_INVITE_BASE?.replace('/u/', '/f/') ?? 'https://sweetinapp.netlify.app/f/';

/**
 * « ma story » / « mon lien » : l'expéditeur revoit son propre sweet tel que les gens le voient,
 * avec les statistiques (vues, lus, temps de lecture) et le partage du lien à portée de main.
 * Le contenu détruit (lien privé gratté, story fondue) ne montre plus que les stats.
 */
export default function Mine() {
  const { token } = useLocalSearchParams<{ token: string }>();
  if (!token) return <Redirect href="/" />;
  return <MineScreen token={String(token)} />;
}

function MineScreen({ token }: { token: string }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const tilt = useTilt();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [flip, setFlip] = useState<MineFlip | null>(null);
  const [photo, setPhoto] = useState<SkImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let alive = true;
    openMine(token)
      .then(async (f) => {
        if (!alive) return;
        setFlip(f);
        track('mine_opened', { kind: f.kind });
        if (f.photo_url && !f.gone) {
          const img = await loadImageInMemory(f.photo_url);
          if (alive) setPhoto(img);
        }
      })
      .catch((e) => alive && setError(humanError(e)));
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => () => photo?.dispose(), [photo]);

  const linkUrl = `${LINK_BASE}${encodeURIComponent(token)}`;
  const share = () =>
    Share.share({ message: t('link.message', { url: linkUrl }) }).then((r) => {
      if (r.action === Share.sharedAction) track('mine_shared', { via: r.activityType ?? 'share' });
    });
  const copy = () => Clipboard.setStringAsync(linkUrl).then(() => toast(t('story.copied')));

  const story = flip?.kind === 'story';
  const stat = flip
    ? story
      ? t('link.storyStats', { o: flip.opens, s: flip.scratches })
      : flip.scratched_at
        ? t('inbox.scratched', { s: seconds(flip.duration_ms) })
        : flip.opened_at
          ? t('link.opened')
          : t('link.waiting')
    : '';

  if (error) {
    return (
      <Screen tone="cerise">
        <View style={[s.head, { marginTop: insets.top + 4 }]}>
          <BackButton tone="cerise" />
        </View>
        <View style={s.center}>
          <Fondue mood="melt" size={130} />
          <Title tone="cerise" size={40} style={{ textAlign: 'center' }}>
            {error}
          </Title>
        </View>
      </Screen>
    );
  }

  return (
    <Screen tone="cacao">
      {/* contenu : la story telle que les gens la grattent (le mot est visible d'office, c'est le nôtre) */}
      <View style={StyleSheet.absoluteFill}>
        {!flip ? (
          <Shimmer style={{ width: screenW, height: screenH }} />
        ) : flip.gone || !photo ? (
          <View style={s.center}>
            <Fondue mood="melt" size={130} />
            <Text style={s.goneT}>{t('mine.gone')}</Text>
          </View>
        ) : (
          <ScratchCard
            photo={photo}
            message={flip.message ?? ''}
            wordStyle={flip.word_style}
            mode="free"
            width={screenW}
            height={screenH}
            radius={0}
            showHint={false}
            tilt={tilt}
            onReveal={() => setRevealed(true)}
            forceReveal
          />
        )}
      </View>

      {/* en-tête : retour + titre + stats */}
      <View style={[s.head, { marginTop: insets.top + 4 }]} pointerEvents="box-none">
        <BackButton tone="cerise" onPress={() => (router.canGoBack() ? router.back() : router.replace('/inbox'))} />
      </View>
      {flip ? (
        <Animated.View entering={FadeInDown.springify()} style={[s.stats, { top: insets.top + 14 }]} pointerEvents="none">
          <View style={s.statPill}>
            <Icon name={story ? 'story' : 'link'} size={14} color={colors.cacao} stroke={2.6} />
            <Text style={s.statT}>{story ? t('link.sentStory') : t('link.sentPrivate')}</Text>
            <Text style={s.statS}>{stat}</Text>
          </View>
          <Text style={s.statAgo}>{agoShort(flip.created_at)}</Text>
        </Animated.View>
      ) : null}

      {/* bas : repartager */}
      {flip && !flip.gone ? (
        <Animated.View entering={FadeInDown.delay(200).springify()} style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <Button label={t('mine.share')} icon="share" onPress={share} />
          <Button label={t('mine.copy')} icon="link" tone="white" size="sm" onPress={copy} />
        </Animated.View>
      ) : null}
      {revealed ? null : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  goneT: { ...tx.bold, fontSize: 20, color: colors.onCoeur, textAlign: 'center' },
  stats: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 4, zIndex: 5 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.citron, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2.5, borderColor: colors.white },
  statT: { ...tx.bold, fontSize: 14, color: colors.cacao },
  statS: { ...tx.bold, fontSize: 13, color: colors.cacao, opacity: 0.7 },
  statAgo: { ...tx.bold, fontSize: 12, color: colors.white, opacity: 0.8, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 6 },
});
