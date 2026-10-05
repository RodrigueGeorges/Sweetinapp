import { Text } from 'react-native';

/**
 * Les 5 réactions Sweetin. On stocke et on affiche l'emoji du système (Apple, Google) :
 * c'est ce que font les apps de référence, et c'est mieux dessiné que tout ce qu'on referait en code.
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

const EMOJI: Record<ReactionKey, string> = Object.fromEntries(REACTIONS.map((r) => [r.key, r.emoji])) as Record<ReactionKey, string>;

export function ReactionFace({ kind, size = 32 }: { kind: ReactionKey; size?: number }) {
  return (
    <Text allowFontScaling={false} style={{ fontSize: size * 0.84, lineHeight: size, width: size, height: size, textAlign: 'center' }}>
      {EMOJI[kind]}
    </Text>
  );
}
