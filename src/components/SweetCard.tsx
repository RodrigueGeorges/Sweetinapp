import { Image as ExpoImage } from 'expo-image';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from '../i18n';
import type { InboxItem } from '../lib/api';
import { agoShort } from '../lib/format';
import { previewUri } from '../lib/preview';
import { thumbhashOf } from '../lib/thumb';
import { colors, fonts, tx } from '../theme';
import { DRIP_EDGE_INVERSE, DRIP_EDGE_RATIO } from './dripEdge';
import { Glass } from './Glass';
import { Avatar, HoloFill } from './ui';

const SUGAR = require('../../assets/sucre-givre.png');

/**
 * Le bord qui coule : à poser en bas d'une carte photo posée sur `bg` (le fond de l'écran).
 * La vague et les deux gouttes se dessinent en peignant le fond par-dessus le bas de la carte.
 */
export function DripEdge({ width, bg = colors.paper }: { width: number; bg?: string }) {
  const h = width * DRIP_EDGE_RATIO;
  return (
    <Svg width={width} height={h} viewBox="0 0 400 82" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: 0 }} pointerEvents="none">
      <Path d={DRIP_EDGE_INVERSE} fill={bg} />
    </Svg>
  );
}

/** Le sucre givré : voile blanc et cristaux qui scintillent, sur tout sweet pas encore gratté. */
export function Sugar({ strength = 1 }: { strength?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${0.12 * strength})` }]} />
      <Image source={SUGAR} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: Math.min(1, 0.62 * strength) }]} accessibilityIgnoresInvertColors />
    </View>
  );
}

/**
 * Un sweet reçu dans la vitrine (DA Fondant) : la photo floutée sous le sucre givré, coins hauts arrondis,
 * le bas qui coule. `hero` : la grande carte du dessus, avec « gratte. » au milieu.
 */
export function SweetCard({ item, width, height, hero = false }: { item: InboxItem; width: number; height: number; hero?: boolean }) {
  const edge = width * DRIP_EDGE_RATIO;
  const hash = item.preview ? thumbhashOf(item.preview) : null;
  const radius = hero ? 28 : 26;
  return (
    <View style={{ width, height }}>
      {/* lumière ambiante : la couleur de la photo baigne le dessous de la grande carte */}
      {hero && hash ? <ExpoImage placeholder={{ thumbhash: hash }} placeholderContentFit="cover" blurRadius={42} style={[StyleSheet.absoluteFill, { top: 22, left: 6, right: 6, bottom: -6, opacity: 0.5, transform: [{ scale: 1.03 }] }]} accessibilityIgnoresInvertColors /> : null}
      <View style={[s.card, { width, height, borderTopLeftRadius: radius, borderTopRightRadius: radius }]}>
        {item.preview ? (
          <ExpoImage
            placeholder={hash ? { thumbhash: hash } : { uri: previewUri(item.preview) }}
            placeholderContentFit="cover"
            blurRadius={hash ? 0 : 16}
            style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <HoloFill style={StyleSheet.absoluteFill} />
        )}
        <Sugar />
        {hero ? (
          <Text style={[s.scratch, { top: height * 0.33 }]} allowFontScaling={false}>
            {t('inbox.scratch')}
          </Text>
        ) : null}
        {item.mode === 'once' ? (
          <View style={s.once}>
            <Text style={s.onceT}>{t('inbox.oncePass')}</Text>
          </View>
        ) : null}
        <View style={[s.dot, hero && { top: 13, right: 13 }]} />
        <Glass style={[s.chip, { left: hero ? 12 : 10, bottom: edge * 0.69 + (hero ? 24 : 18) }]}>
          <Avatar name={item.sender.username} uri={item.sender.avatar_url} size={hero ? 24 : 22} />
          <Text style={s.chipT} numberOfLines={1}>
            {item.sender.username} · {agoShort(item.created_at)}
          </Text>
        </Glass>
        <DripEdge width={width} />
      </View>
    </View>
  );
}

/**
 * Vignette d'un sweet envoyé (onglet envoyés) : la photo floutée sous le sucre, le bas qui coule.
 * Une fois lu, le sucre est parti et la photo est noyée dans le cœur nuit, avec « fondu ».
 */
export function SentThumb({ preview, melted, width = 54 }: { preview?: string | null; melted?: boolean; width?: number }) {
  const height = Math.round(width * 1.34);
  const hash = preview ? thumbhashOf(preview) : null;
  return (
    <View style={{ width, height, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden', backgroundColor: colors.card }}>
      {hash ? <ExpoImage placeholder={{ thumbhash: hash }} placeholderContentFit="cover" style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]} accessibilityIgnoresInvertColors /> : <HoloFill style={StyleSheet.absoluteFill} />}
      {melted ? (
        <View style={[StyleSheet.absoluteFill, s.thumbMelt]}>
          <Text style={s.thumbMeltT} allowFontScaling={false}>
            {t('inbox.melted')}
          </Text>
        </View>
      ) : (
        <Sugar strength={0.8} />
      )}
      <DripEdge width={width} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.card },
  scratch: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: fonts.display, includeFontPadding: false, fontSize: 44, color: colors.white, textShadowColor: 'rgba(22,15,18,0.35)', textShadowRadius: 22, textShadowOffset: { width: 0, height: 2 } },
  once: { position: 'absolute', top: 12, left: 12, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: colors.cacao },
  onceT: { ...tx.black, fontSize: 12, lineHeight: 15, color: colors.white },
  // pastille « pas encore lu » : 12 pt de framboise cerclés de 3 pt du fond
  dot: { position: 'absolute', top: 11, right: 11, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.cerise, borderWidth: 3, borderColor: colors.paper },
  chip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 11, borderRadius: 999, maxWidth: '86%' },
  chipT: { flexShrink: 1, ...tx.bold, fontSize: 13, color: colors.white },
  thumbMelt: { backgroundColor: 'rgba(22,15,18,0.62)', alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  thumbMeltT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 10, color: colors.white },
});
