import { Image as ExpoImage } from 'expo-image';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import type { InboxItem } from '../lib/api';
import { agoShort } from '../lib/format';
import { previewUri } from '../lib/preview';
import { thumbhashOf } from '../lib/thumb';
import { colors, fonts, tx } from '../theme';
import { Glass } from './Glass';
import { Glint } from './Glint';
import type { SharedValue } from 'react-native-reanimated';
import { Avatar, HoloFill } from './ui';
import { isWelcome, WELCOME_PHOTO } from '../lib/welcome';

const SUGAR = require('../../assets/sucre-givre.png');

/** Le sucre givré : voile blanc et cristaux qui scintillent, sur tout sweet pas encore gratté. */
export function Sugar({ strength = 1 }: { strength?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${0.12 * strength})` }]} />
      {Platform.OS === 'web' ? (
        // react-native-web ne répète pas l'image sur toute la carte (on voyait un carré de cristaux) : pavage à la main
        <View style={[s.tiles, { opacity: Math.min(1, 0.62 * strength) }]}>
          {Array.from({ length: 20 }, (_, i) => (
            <Image key={i} source={SUGAR} style={s.tile} accessibilityIgnoresInvertColors />
          ))}
        </View>
      ) : (
        <Image source={SUGAR} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: Math.min(1, 0.62 * strength) }]} accessibilityIgnoresInvertColors />
      )}
    </View>
  );
}

/**
 * Un sweet reçu dans la vitrine (DA Fondant) : la photo floutée sous le sucre givré, coins arrondis.
 * Pas de coulure sur les cartes : un sweet non lu n'a pas encore fondu (la coulure reste pour la lecture, le splash et le logo).
 * `hero` : la grande carte du dessus, avec « gratte. » au milieu.
 */
export function SweetCard({ item, width, height, hero = false, tilt }: { item: InboxItem; width: number; height: number; hero?: boolean; tilt?: { x: SharedValue<number>; y: SharedValue<number> } }) {
  const hash = item.preview ? thumbhashOf(item.preview) : null;
  const radius = hero ? 28 : 26;
  return (
    <View style={{ width, height }}>
      <View style={[s.card, { width, height, borderRadius: radius }]}>
        {isWelcome(item.flip_id) ? (
          <ExpoImage source={WELCOME_PHOTO} contentFit="cover" blurRadius={22} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]} accessibilityIgnoresInvertColors />
        ) : item.preview ? (
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
        {/* les cristaux accrochent la lumière quand on incline le téléphone */}
        {tilt ? <Glint width={width} height={height} tilt={tilt} strength={hero ? 1 : 0.8} /> : null}
        {hero ? (
          <Text style={[s.scratch, { top: height * 0.33 }]} allowFontScaling={false}>
            {t('inbox.scratch')}
          </Text>
        ) : null}
        <View style={[s.dot, hero && { top: 13, right: 13 }]} />
        {/* petites cartes : pastille en haut, sinon le déclencheur la cache au premier coup d'œil */}
        <Glass style={[s.chip, hero ? { left: 12, bottom: 14 } : { left: 10, top: 10, maxWidth: width - 48 }]}>
          <Avatar name={item.sender.username} uri={item.sender.avatar_url} size={hero ? 24 : 22} />
          <Text style={s.chipT} numberOfLines={1}>
            {item.sender.username} · {agoShort(item.created_at)}
          </Text>
        </Glass>
      </View>
    </View>
  );
}

/**
 * Vignette d'un sweet envoyé (onglet envoyés) : la photo floutée sous le sucre, coins arrondis.
 * Une fois lu, le sucre est parti et la photo est noyée dans le cœur nuit, avec « fondu ».
 */
export function SentThumb({ preview, melted, width = 54 }: { preview?: string | null; melted?: boolean; width?: number }) {
  const height = Math.round(width * 1.34);
  const hash = preview ? thumbhashOf(preview) : null;
  return (
    <View style={{ width, height, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.card }}>
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
    </View>
  );
}

const s = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.card },
  tiles: { position: 'absolute', left: 0, top: 0, width: 512, height: 640, flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: 128, height: 128 },
  scratch: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: fonts.display, includeFontPadding: false, fontSize: 44, color: colors.white, textShadowColor: 'rgba(22,15,18,0.35)', textShadowRadius: 22, textShadowOffset: { width: 0, height: 2 } },
  // pastille « pas encore lu » : 12 pt de framboise cerclés de 3 pt du fond
  dot: { position: 'absolute', top: 11, right: 11, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.cerise, borderWidth: 3, borderColor: colors.paper },
  chip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 11, borderRadius: 999, maxWidth: '86%' },
  chipT: { flexShrink: 1, ...tx.bold, fontSize: 13, color: colors.white },
  thumbMelt: { backgroundColor: 'rgba(22,15,18,0.62)', alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  thumbMeltT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 10, color: colors.white },
});
