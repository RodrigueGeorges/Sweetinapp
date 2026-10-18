import { StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colors, fonts } from '../theme';

/**
 * Les 5 réactions Sweetin (DA Fondant) : des autocollants découpés, pas des emoji.
 * On stocke toujours l'emoji côté serveur (compatible notifications) ; l'app affiche le mot.
 * je fonds 🫠 · mdrr 😂 · jpp 😳 · omg ❤️ · encore 🍦
 */
export const REACTIONS = [
  { emoji: '🫠', key: 'melt' },
  { emoji: '😂', key: 'lol' },
  { emoji: '😳', key: 'shock' },
  { emoji: '❤️', key: 'love' },
  { emoji: '🍦', key: 'more' },
] as const;
export type ReactionKey = (typeof REACTIONS)[number]['key'];

const byEmoji: Record<string, ReactionKey> = Object.fromEntries(REACTIONS.map((r) => [r.emoji, r.key]));
/** Anciennes réactions : on les ramène à la plus proche. */
const legacy: Record<string, ReactionKey> = { '🥹': 'melt', '🫣': 'shock', '💀': 'lol', '🔥': 'love' };
export const reactionKey = (emoji: string | null | undefined): ReactionKey | null => (emoji ? byEmoji[emoji] ?? legacy[emoji] ?? null : null);

/** Teinte, forme et inclinaison fixes par mot, pour que la rangée garde son rythme d'un écran à l'autre. */
const LOOK: Record<ReactionKey, { bg: string; fg: string; shape: 'pill' | 'square' | 'round'; rot: number }> = {
  melt: { bg: colors.cacao, fg: colors.white, shape: 'pill', rot: -4 },
  lol: { bg: colors.cerise, fg: colors.cacao, shape: 'square', rot: 3 },
  shock: { bg: colors.citron, fg: colors.cacao, shape: 'round', rot: -3 },
  love: { bg: colors.sucre, fg: colors.cacao, shape: 'round', rot: 4 },
  more: { bg: colors.white, fg: colors.cacao, shape: 'pill', rot: -2 },
};

/**
 * Un autocollant de réaction : le mot en display, posé de travers, liseré blanc de 3 pt et ombre douce.
 * `on` : choisi (framboise) ; `dim` : une autre a été choisie (40 %).
 */
export function Sticker({ kind, size = 'md', on, dim }: { kind: ReactionKey; size?: 'sm' | 'md'; on?: boolean; dim?: boolean }) {
  const look = LOOK[kind];
  const sm = size === 'sm';
  const fs = sm ? 11 : 17;
  const word = t(`react.${kind}`);
  const round = look.shape === 'round' && word.length <= 3;
  const bg = on ? colors.cerise : look.bg;
  const fg = on ? colors.cacao : look.fg; // nuit sur framboise, lisible (AA)
  return (
    <View style={[s.wrap, { transform: [{ rotate: `${look.rot}deg` }], opacity: dim ? 0.4 : 1 }, sm && s.wrapSm]}>
      <View
        style={[
          s.body,
          { backgroundColor: bg, borderRadius: look.shape === 'square' ? (sm ? 8 : 12) : 999 },
          round ? { width: sm ? 38 : 64, height: sm ? 38 : 64, paddingHorizontal: 0 } : { paddingVertical: sm ? 4 : 9, paddingHorizontal: sm ? 9 : 16 },
          sm ? s.shadowSm : s.shadow,
          sm && { borderWidth: 2 },
        ]}
      >
        <Text style={[s.t, { fontSize: fs, color: fg }]} allowFontScaling={false} numberOfLines={1}>
          {word}
        </Text>
      </View>
    </View>
  );
}

/** La réaction reçue, en petit autocollant (liste des envois). */
export function ReactionFace({ kind }: { kind: ReactionKey; size?: number }) {
  return <Sticker kind={kind} size="sm" />;
}

const s = StyleSheet.create({
  // l'ombre est portée par l'autocollant lui-même (arrondi, fond) : sur le conteneur, elle dessinait un rectangle (web) ou rien (Android)
  wrap: {},
  wrapSm: {},
  shadow: { shadowColor: '#160F12', shadowOpacity: 0.25, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  shadowSm: { shadowColor: '#160F12', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  body: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white },
  t: { fontFamily: fonts.display, includeFontPadding: false },
});
