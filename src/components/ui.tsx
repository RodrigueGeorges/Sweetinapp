import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { forwardRef, useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { avatarColor, colors, displayScale, fonts, holo, isDark, layout, motion, tx } from '../theme';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';

export type Tone = 'vanille' | 'cerise' | 'cacao';

// « vanille » = l'ambiance papier de l'interface : nuit par défaut, blanc en mode clair (nom gardé pour l'historique)
const TONE = {
  vanille: { bg: colors.paper, fg: colors.ink, sub: colors.muted, line: colors.ink, shadow: colors.ink },
  // « cerise » = les écrans de marque : même fond net que l'interface, le fun vient des photos et des autocollants
  cerise: { bg: colors.paper, fg: colors.ink, sub: colors.muted, line: colors.ink, shadow: colors.ink },
  cacao: { bg: colors.cacao, fg: colors.white, sub: colors.mutedOnDark, line: colors.white, shadow: colors.cerise },
} as const;
export const toneOf = (tone: Tone) => TONE[tone];

/** Fond plein écran d'une des trois ambiances. Règle aussi la barre d'état quand l'écran est affiché. */
export function Screen({ tone = 'vanille', children, style }: { tone?: Tone; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(tone === 'vanille' && !isDark ? 'dark' : 'light', true);
    }, [tone]),
  );
  return <View style={[{ flex: 1, backgroundColor: TONE[tone].bg }, style]}>{children}</View>;
}

/**
 * Carte. Plate et calme : surface un cran au-dessus du fond, filet très fin. Pas d'ombre (le relief se lit à la luminosité).
 * `offset` (ombre dure) n'est plus utilisé que pour l'objet signature : le polaroid.
 */
export function Pop({
  children,
  style,
  radius = layout.radius,
  offset = 0,
  shadow = colors.cacao,
  bg = colors.card,
  border = colors.line,
  borderWidth = 1,
  rotate,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  offset?: number;
  shadow?: string;
  bg?: string;
  border?: string;
  borderWidth?: number;
  rotate?: number;
}) {
  return (
    <View style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}>
      {offset > 0 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: offset, left: offset, right: -offset, bottom: -offset, borderRadius: radius, backgroundColor: shadow }]} />}
      <View style={[{ borderRadius: radius, backgroundColor: bg, borderWidth, borderColor: border }, style]}>{children}</View>
    </View>
  );
}

/** Le dégradé holo, pour tout ce qui se gratte. */
export function HoloFill({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <LinearGradient colors={holo.colors} locations={holo.locations} start={holo.start} end={holo.end} style={style}>
      {children}
    </LinearGradient>
  );
}

type ButtonTone = 'nuit' | 'cerise' | 'vanille' | 'pistache' | 'cacao' | 'white' | 'snow' | 'noir' | 'holo' | 'bubblegum';
// DA Fondant : nuit = l'action principale de l'écran (blanche en sombre, nuit y compris sur la framboise) ;
// cerise = une seule action de marque par écran (sauver une série, déclencher) ; white = secondaire doux ; snow = blanc sur la marque ou sur photo
const BTN: Record<ButtonTone, { bg: string; fg: string }> = {
  nuit: { bg: isDark ? '#FFFFFF' : '#160F12', fg: isDark ? '#160F12' : '#FFFFFF' },
  cerise: { bg: colors.cerise, fg: colors.cacao }, // texte nuit sur framboise : 5,2:1 (le blanc ne fait que 3,6:1)
  snow: { bg: colors.white, fg: '#C40E3B' },
  noir: { bg: '#160F12', fg: '#FFFFFF' }, // encre fixe, dans les deux modes
  vanille: { bg: colors.vanille, fg: colors.cacao },
  pistache: { bg: colors.pistache, fg: colors.cacao },
  cacao: { bg: isDark ? colors.ghost : colors.ink, fg: isDark ? colors.ink : colors.vanille },
  white: { bg: colors.card, fg: colors.ink },
  holo: { bg: 'transparent', fg: colors.cacao },
  bubblegum: { bg: colors.bubblegum, fg: colors.cacao },
};

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  tone?: ButtonTone;
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  arrow?: boolean;
  loading?: boolean;
  /** @deprecated plus d'ombre dure sur les boutons */
  shadow?: string;
  border?: string;
  style?: StyleProp<ViewStyle>;
  haptic?: 'light' | 'medium' | 'selection' | false;
};

/**
 * Bouton : pilule pleine, sans contour ni ombre, libellé en Funnel Sans très gras. Le principal est nuit ;
 * la framboise est réservée à une action de marque par écran. À l'appui, il s'enfonce avec une vibration.
 */
export function Button({ label, tone = 'nuit', size = 'lg', icon, arrow, loading, border, style, disabled, haptic = 'light', onPressIn, onPressOut, ...rest }: ButtonProps) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  const inactive = !!disabled && !loading;
  const h = size === 'lg' ? 58 : size === 'md' ? 48 : 38;
  const bw = border ? 1.5 : 0;
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * (size === 'lg' ? 0.035 : 0.05) }] }));
  const c = inactive ? { bg: colors.sand, fg: colors.muted } : BTN[tone];
  const fs = size === 'lg' ? 17 : size === 'md' ? 16 : 14;
  const content = (
    <View style={[s.btnRow, { height: h - bw * 2, paddingHorizontal: size === 'sm' ? 14 : 22 }]}>
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={fs + 3} color={c.fg} />}
          <Text style={[s.btnT, { fontSize: fs, color: c.fg }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>
            {label}
          </Text>
          {arrow && <Icon name="arrow" size={fs + 2} color={c.fg} stroke={2.8} />}
        </>
      )}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPressIn={(e) => {
        if (!reduce) p.value = withSpring(1, motion.press);
        if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        else if (haptic === 'selection') Haptics.selectionAsync();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        p.value = withSpring(0, motion.pop);
        onPressOut?.(e);
      }}
      style={style}
      {...rest}
    >
      <Animated.View style={[{ borderRadius: h / 2, borderWidth: bw, borderColor: border, backgroundColor: c.bg, overflow: 'hidden' }, anim]}>
        {tone === 'holo' && !inactive ? <HoloFill>{content}</HoloFill> : content}
      </Animated.View>
    </Pressable>
  );
}

/** Bouton principal collé en bas de l'écran, au-dessus de la zone sûre. */
export function BottomCTA({ children, tone = 'vanille', style }: { children: ReactNode; tone?: Tone | 'none'; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const bg = tone !== 'none' ? TONE[tone].bg : null;
  return (
    <View style={[s.cta, { paddingBottom: Math.max(insets.bottom, 16) + 4 }, bg != null && { backgroundColor: bg }, style]}>
      {/* fondu au-dessus de la barre : ce qui défile dessous s'efface au lieu d'être coupé net */}
      {bg != null && /^#[0-9A-Fa-f]{6}$/.test(bg) ? <LinearGradient pointerEvents="none" colors={[`${bg}00`, bg]} style={s.ctaFade} /> : null}
      {children}
    </View>
  );
}

/** Bouton rond à icône (retour, menu…). */
export function IconButton({ icon, label, onPress, tone = 'vanille', size = 40, filled }: { icon: IconName; label: string; onPress: () => void; tone?: Tone; size?: number; filled?: boolean }) {
  const reduce = useReducedMotion();
  const sc = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability -- une shared value Reanimated se mute dans les callbacks
        if (!reduce) sc.value = withSpring(0.86, motion.press);
        Haptics.selectionAsync();
      }}
      // eslint-disable-next-line react-hooks/immutability -- idem
      onPressOut={() => (sc.value = withSpring(1, motion.pop))}
      onPress={onPress}
    >
      <Animated.View
        style={[
          { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
          tone === 'vanille' || tone === 'cerise' ? s.iconLight : { backgroundColor: 'rgba(255,255,255,0.18)' },
          filled && tone === 'cacao' && { backgroundColor: 'rgba(22,15,18,0.45)' },
          anim,
        ]}
      >
        <Icon name={icon} size={size * 0.5} color={tone === 'vanille' || tone === 'cerise' ? colors.ink : colors.white} stroke={2.4} />
      </Animated.View>
    </Pressable>
  );
}

export function BackButton({ onPress, tone = 'vanille' }: { onPress?: () => void; tone?: Tone }) {
  return (
    <IconButton
      icon="back"
      label={t('common.back')}
      tone={tone}
      onPress={() => {
        if (onPress) onPress();
        else if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
    />
  );
}

type HeaderProps = { title?: string; back?: boolean | (() => void); right?: ReactNode; tone?: Tone; logo?: boolean };

/** En-tête : retour à gauche, titre condensé (ou logo) au centre, action à droite. */
export function Header({ title, back, right, tone = 'vanille', logo }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const c = TONE[tone];
  return (
    <View style={[s.head, { marginTop: insets.top + 4 }]}>
      <View style={s.side}>{back ? <BackButton tone={tone} onPress={typeof back === 'function' ? back : undefined} /> : null}</View>
      <View style={s.mid}>
        {title ? (
          <Text style={[s.headT, { color: c.fg }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : logo ? (
          <Logo size={24} color={tone === 'cacao' ? colors.white : colors.ink} />
        ) : null}
      </View>
      <View style={[s.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

/** Barre du haut des onglets : logo à gauche, actions à droite. */
export function TopBar({ right, tone = 'vanille' }: { right?: ReactNode; tone?: Tone }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.top, { marginTop: insets.top + 6 }]}>
      <Logo size={24} color={tone === 'cacao' ? colors.white : colors.ink} />
      <View style={{ flexDirection: 'row', gap: 10 }}>{right}</View>
    </View>
  );
}

/** Grand titre en Climate Crisis, en minuscules, ponctuation forte. `size` = taille pensée pour une fonte normale. */
export function Title({ children, style, tone = 'vanille', size = 40 }: { children: ReactNode; style?: StyleProp<TextStyle>; tone?: Tone; size?: number }) {
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: fonts.display, includeFontPadding: false, fontSize: size * displayScale, lineHeight: size * displayScale * 1.12, color: TONE[tone].fg }, style]} maxFontSizeMultiplier={1.15}>
      {children}
    </Text>
  );
}

export function Body({ children, style, tone = 'vanille' }: { children: ReactNode; style?: StyleProp<TextStyle>; tone?: Tone }) {
  return <Text style={[{ ...(tone === 'cerise' ? tx.bold : tx.text), fontSize: 16, lineHeight: 23, color: tone === 'cacao' ? colors.vanille : colors.ink }, style]}>{children}</Text>;
}

/** Petit intertitre en capitales espacées. */
export function SectionLabel({ children, tone = 'vanille', style }: { children: ReactNode; tone?: Tone; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.sec, { color: TONE[tone].sub }, style]}>{children}</Text>;
}

/** Pastille sticker (statut, compteur, étiquette). */
export function Chip({ label, tone = 'vanille', icon, rotate, size = 'md', style }: { label: string; tone?: ButtonTone; icon?: IconName; rotate?: number; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  const c = tone === 'vanille' ? { bg: colors.card, fg: colors.ink } : BTN[tone];
  const sm = size === 'sm';
  const inner = (
    <View style={[s.chip, sm && { paddingVertical: 3, paddingHorizontal: 8, gap: 3 }]}>
      {icon && <Icon name={icon} size={sm ? 13 : 16} color={c.fg} />}
      <Text style={[s.chipT, { color: c.fg }, sm && { fontSize: 12 }]}>{label}</Text>
    </View>
  );
  return (
    <View style={[{ alignSelf: 'flex-start' }, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]}>
      <View style={{ borderRadius: 999, borderWidth: tone === 'white' ? 1 : 0, borderColor: colors.line, backgroundColor: tone === 'vanille' ? colors.card : c.bg, overflow: 'hidden' }}>{tone === 'holo' ? <HoloFill>{inner}</HoloFill> : inner}</View>
    </View>
  );
}

/**
 * Jours de série en grand chiffre (DA Fondant) : Climate Crisis, sauf un 6 ou un 9 tout seul, qu'on écrit en Funnel Sans
 * très gras (le 6 de Climate Crisis se lit comme un G). L'unité (j / d) reste en Funnel Sans.
 */
export function StreakNum({ days, atRisk, size = 26 }: { days: number; atRisk?: boolean; size?: number }) {
  const lone = /^[69]$/.test(String(days));
  const color = atRisk ? colors.ceriseText : colors.ink;
  return (
    <Text style={{ color }} allowFontScaling={false} accessibilityLabel={t('send.streak', { n: days })}>
      <Text style={lone ? { fontFamily: fonts.black, fontSize: size * 0.95 } : { fontFamily: fonts.displayHeavy, fontSize: size }}>{days}</Text>
      {/* l'unité toujours : « 41j », comme « 6j de série » partout ailleurs */}
      <Text style={{ fontFamily: fonts.black, fontSize: size * 0.62 }}>{t('streak.unit')}</Text>
    </Text>
  );
}

/** Série : pastille avec la petite glace de la marque (framboise vive quand la série va s'éteindre). */
export function StreakPill({ days, atRisk }: { days: number; atRisk?: boolean }) {
  return (
    <View style={[s.streak, { backgroundColor: atRisk ? colors.riskBg : colors.card }]} accessible accessibilityLabel={String(days)}>
      <Icon name="scoop" size={14} color={atRisk ? colors.ceriseDeep : colors.ceriseText} />
      <Text style={[s.streakT, atRisk && { color: colors.ceriseDeep }]}>{days}</Text>
    </View>
  );
}

/**
 * Avatar : la photo de profil, sinon l'initiale sur une couleur sorbet douce.
 * `ring` (sur photo) : liseré blanc et ombre douce. `flavor` : un liseré du parfum de la personne
 * (visible seulement quand il y a une photo — sans photo, le fond est déjà son parfum).
 */
export function Avatar({ name, uri, size = 38, ring = false, flavor = false }: { name: string; uri?: string | null; size?: number; ring?: boolean; flavor?: boolean }) {
  const bw = ring ? Math.max(2, Math.round(size * 0.06)) : 0;
  const wrap = { width: size, height: size, borderRadius: size / 2, borderWidth: bw, borderColor: colors.white, backgroundColor: avatarColor(name), overflow: 'hidden' as const, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={ring ? s.avShadow : null}>
      <View style={flavor && uri ? { borderRadius: size / 2 + 3, borderWidth: 2, borderColor: avatarColor(name), padding: 1.5 } : undefined}>
        <View style={wrap}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
        ) : (
          <Text style={{ fontFamily: fonts.black, includeFontPadding: false, fontSize: size * 0.38, color: colors.cacao }} allowFontScaling={false}>
            {name.slice(0, 2).replace(/^./, (c) => c.toUpperCase())}
          </Text>
        )}
        </View>
      </View>
    </View>
  );
}

/** Ligne de liste sans cadre (ami, envoi). */
export function Row({ children, onPress, onLongPress, style, active, accessibilityLabel, accessibilityRole, accessibilityState }: { children: ReactNode; onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; active?: boolean } & Pick<PressableProps, 'accessibilityLabel' | 'accessibilityRole' | 'accessibilityState'>) {
  const box = [s.row, active && s.rowOn, style];
  if (!onPress) return <View style={box}>{children}</View>;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityRole ?? 'button'} accessibilityState={accessibilityState} style={({ pressed }) => [box, pressed && { backgroundColor: colors.card, borderRadius: 14 }]}>
      {children}
    </Pressable>
  );
}

/** Case à cocher carrée cacao. */
export function Check({ on }: { on: boolean }) {
  return (
    <View style={[s.check, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
      {on && <Icon name="check" size={14} color={colors.paper} stroke={3.2} />}
    </View>
  );
}

/** Interrupteur aux couleurs de la DA. */
export function Toggle({ value, onValueChange, label, disabled }: { value: boolean; onValueChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{ true: colors.cerise, false: colors.sand }} thumbColor={colors.white} {...({ activeThumbColor: colors.white } as object)} ios_backgroundColor={colors.sand} />;
}

type FieldProps = TextInputProps & { label: string; hint?: string; tone?: Tone; prefix?: string; right?: ReactNode; error?: boolean };

/** Champ de saisie : carte blanche au trait sable, cacao quand on écrit dedans. */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, hint, tone = 'vanille', style, onFocus, onBlur, prefix, right, error, ...rest }, ref) {
  const [focus, setFocus] = useState(false);
  const c = TONE[tone];
  return (
    <View style={{ gap: 7 }}>
      <Text style={[s.fieldL, { color: c.fg }]}>{label}</Text>
      <View style={[s.fieldBox, focus && { borderColor: colors.ink }, error && { borderColor: colors.ceriseDeep }]}>
      {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.ink}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={[s.field, prefix ? { paddingLeft: 2 } : null, style]}
        {...rest}
      />
      {right ? <View style={s.fieldRight}>{right}</View> : null}
      </View>
      {hint ? <Text style={[s.hint, { color: error ? colors.ceriseDeep : c.sub }]}>{hint}</Text> : null}
    </View>
  );
});

/** Pastille ronde avec une icône, pour les états vides et les écrans d'attente. */
export function IconBadge({ icon, tone = 'vanille', size = 72 }: { icon: IconName; tone?: Tone; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
      <Icon name={icon} size={size * 0.42} color={colors.ink} stroke={2.2} />
    </View>
  );
}

/** État vide : une icône, une phrase, une action. */
export function Empty({ art, title, body, action }: { art?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      {art ? <View style={{ alignItems: 'center', marginBottom: 4 }}>{art}</View> : null}
      <Title size={28} style={{ textAlign: 'center' }}>
        {title}
      </Title>
      {body ? <Text style={s.emptyB}>{body}</Text> : null}
      {action}
    </View>
  );
}

const s = StyleSheet.create({
  ctaFade: { position: 'absolute', left: 0, right: 0, top: -32, height: 32 },
  streak: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 3, paddingVertical: 3, paddingLeft: 6, paddingRight: 9, borderRadius: 999 },
  streakT: { ...tx.black, fontSize: 12.5, color: colors.ink },
  avShadow: { borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  head: { height: layout.headerHeight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  side: { width: 64 },
  mid: { flex: 1, alignItems: 'center' },
  headT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 18 },
  top: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnT: { ...tx.black },
  cta: { paddingHorizontal: 20, paddingTop: 10 },
  // titre de section : tout en minuscules (ton Fondant), gras, pas d'espacement de lettres
  sec: { ...tx.black, fontSize: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 13 },
  chipT: { ...tx.black, fontSize: 13.5 },
  iconLight: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  // lignes aérées, sans cadre : l'avatar et le nom portent la ligne ; la sélection se voit par un fond doux
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 22 },
  rowOn: { backgroundColor: colors.card },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.dashed, alignItems: 'center', justifyContent: 'center' },
  fieldL: { ...tx.bold, fontSize: 14 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  field: { flex: 1, height: '100%', paddingHorizontal: 16, ...tx.bold, fontSize: 17, color: colors.ink },
  prefix: { ...tx.black, fontSize: 17, color: colors.muted, paddingLeft: 16 },
  fieldRight: { paddingRight: 12, paddingLeft: 4 },
  hint: { ...tx.text, fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 32 },
  emptyB: { ...tx.text, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
});
