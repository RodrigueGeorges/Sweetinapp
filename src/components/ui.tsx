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
import { avatarColor, colors, fonts, holo, layout, motion, tx, useStyles, useTheme, type Palette } from '../theme';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';

export type Tone = 'vanille' | 'cerise' | 'cacao';

// « vanille » = l'ambiance papier de l'interface : nuit par défaut, blanc en mode clair (nom gardé pour l'historique)
const TONE = (colors: Palette) =>
  ({
    vanille: { bg: colors.paper, fg: colors.ink, sub: colors.muted, line: colors.ink, shadow: colors.ink },
    // sur cerise : titres vanille, petit texte cacao (contraste 4,9:1 contre 3,5:1 pour le vanille)
    cerise: { bg: colors.cerise, fg: colors.vanille, sub: colors.cacao, line: colors.cacao, shadow: colors.cacao },
    cacao: { bg: colors.cacao, fg: colors.vanille, sub: colors.mutedOnDark, line: colors.vanille, shadow: colors.cerise },
  }) as const;
export const toneOf = (tone: Tone, c: Palette = colors) => TONE(c)[tone];

/** Fond plein écran d'une des trois ambiances. Règle aussi la barre d'état quand l'écran est affiché. */
export function Screen({ tone = 'vanille', children, style }: { tone?: Tone; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, isDark } = useTheme();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(tone === 'vanille' && !isDark ? 'dark' : 'light', true);
    }, [tone, isDark]),
  );
  if (tone === 'cerise') {
    // en mode sombre la marque reste cerise, mais en profondeur (nuit, pas lumière)
    const grad = (isDark ? ['#A01B44', '#7A1330', '#4A0B1D'] : ['#FF4473', colors.cerise, '#EB1650']) as [string, string, string];
    return (
      <LinearGradient colors={grad} locations={[0, 0.45, 1]} style={[{ flex: 1 }, style]}>
        {children}
      </LinearGradient>
    );
  }
  return <View style={[{ flex: 1, backgroundColor: TONE(colors)[tone].bg }, style]}>{children}</View>;
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
  shadow,
  bg,
  border,
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
  const { colors } = useTheme();
  return (
    <View style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}>
      {offset > 0 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: offset, left: offset, right: -offset, bottom: -offset, borderRadius: radius, backgroundColor: shadow ?? colors.cacao }]} />}
      <View style={[{ borderRadius: radius, backgroundColor: bg ?? colors.card, borderWidth, borderColor: border ?? colors.line }, style]}>{children}</View>
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

type ButtonTone = 'cerise' | 'vanille' | 'pistache' | 'cacao' | 'white' | 'snow' | 'holo' | 'bubblegum';
// cerise = action principale ; cacao/white = secondaires (translucides, s'adaptent au mode) ; vanille = sur cerise ou sur photo
const BTN = (colors: Palette, dark: boolean): Record<ButtonTone, { bg: string; fg: string }> => ({
  cerise: { bg: colors.cerise, fg: colors.white },
  snow: { bg: colors.white, fg: colors.cacao }, // sur cerise ou sur photo
  vanille: { bg: colors.vanille, fg: colors.cacao },
  pistache: { bg: colors.pistache, fg: colors.cacao },
  cacao: { bg: dark ? colors.ghost : colors.ink, fg: dark ? colors.ink : colors.vanille },
  white: { bg: colors.card, fg: colors.ink },
  holo: { bg: 'transparent', fg: colors.cacao },
  bubblegum: { bg: colors.bubblegum, fg: colors.cacao },
});

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
 * Bouton 2026 : plein, sans contour ni ombre dure. Le principal (lg) a un léger reflet en haut ;
 * à l'appui, il s'enfonce (échelle) avec une vibration.
 */
export function Button({ label, tone = 'cerise', size = 'lg', icon, arrow, loading, border, style, disabled, haptic = 'light', onPressIn, onPressOut, ...rest }: ButtonProps) {
  const { colors, isDark } = useTheme();
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  const inactive = !!disabled && !loading;
  const h = size === 'lg' ? 58 : size === 'md' ? 48 : 38;
  const bw = border ? 1.5 : 0;
  const shine = size === 'lg' && !inactive && (tone === 'cerise' || tone === 'pistache');
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.value * (size === 'lg' ? 0.035 : 0.05) }] }));
  const c = inactive ? { bg: colors.sand, fg: colors.muted } : BTN(colors, isDark)[tone];
  const fs = size === 'lg' ? 18 : size === 'md' ? 16 : 14;
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
        {/* reflet doux en haut du bouton principal : du relief sans ombre */}
        {shine && <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />}
        {tone === 'holo' && !inactive ? <HoloFill>{content}</HoloFill> : content}
      </Animated.View>
    </Pressable>
  );
}

/** Bouton principal collé en bas de l'écran, au-dessus de la zone sûre. */
export function BottomCTA({ children, tone = 'vanille', style }: { children: ReactNode; tone?: Tone | 'none'; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return <View style={[s.cta, { paddingBottom: Math.max(insets.bottom, 16) + 4 }, tone !== 'none' && { backgroundColor: TONE(colors)[tone].bg }, style]}>{children}</View>;
}

/** Bouton rond à icône (retour, menu…). */
export function IconButton({ icon, label, onPress, tone = 'vanille', size = 40, filled }: { icon: IconName; label: string; onPress: () => void; tone?: Tone; size?: number; filled?: boolean }) {
  const { colors } = useTheme();
  const th = useStyles(themed);
  const reduce = useReducedMotion();
  const sc = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPressIn={() => {
        if (!reduce) sc.value = withSpring(0.86, motion.press);
        Haptics.selectionAsync();
      }}
      onPressOut={() => (sc.value = withSpring(1, motion.pop))}
      onPress={onPress}
    >
      <Animated.View
        style={[
          { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
          tone === 'vanille' ? th.iconLight : { backgroundColor: tone === 'cerise' ? 'rgba(26,10,14,0.14)' : 'rgba(255,247,242,0.16)' },
          filled && tone === 'cacao' && { backgroundColor: 'rgba(26,10,14,0.45)' },
          anim,
        ]}
      >
        <Icon name={icon} size={size * 0.5} color={tone === 'vanille' ? colors.ink : colors.vanille} stroke={2.4} />
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
  const { colors } = useTheme();
  const c = TONE(colors)[tone];
  return (
    <View style={[s.head, { marginTop: insets.top + 4 }]}>
      <View style={s.side}>{back ? <BackButton tone={tone} onPress={typeof back === 'function' ? back : undefined} /> : null}</View>
      <View style={s.mid}>
        {title ? (
          <Text style={[s.headT, { color: c.fg }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : logo ? (
          <Logo size={26} color={tone === 'vanille' ? colors.ink : colors.white} />
        ) : null}
      </View>
      <View style={[s.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

/** Barre du haut des onglets : logo à gauche, actions à droite. */
export function TopBar({ right, tone = 'vanille' }: { right?: ReactNode; tone?: Tone }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[s.top, { marginTop: insets.top + 6 }]}>
      <Logo size={26} color={tone === 'vanille' ? colors.ink : colors.white} />
      <View style={{ flexDirection: 'row', gap: 10 }}>{right}</View>
    </View>
  );
}

/** Grand titre condensé, en minuscules, ponctuation forte. */
export function Title({ children, style, tone = 'vanille', size = 40 }: { children: ReactNode; style?: StyleProp<TextStyle>; tone?: Tone; size?: number }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: fonts.display, includeFontPadding: false, fontSize: size * 0.86, lineHeight: size * 0.86 * 1.08, letterSpacing: -size * 0.018, color: TONE(colors)[tone].fg }, style]} maxFontSizeMultiplier={1.15}>
      {children}
    </Text>
  );
}

export function Body({ children, style, tone = 'vanille' }: { children: ReactNode; style?: StyleProp<TextStyle>; tone?: Tone }) {
  const { colors } = useTheme();
  return <Text style={[{ ...(tone === 'cerise' ? tx.bold : tx.text), fontSize: 16, lineHeight: 23, color: tone === 'cacao' ? colors.vanille : tone === 'cerise' ? colors.cacao : colors.ink }, style]}>{children}</Text>;
}

/** Petit intertitre en capitales espacées. */
export function SectionLabel({ children, tone = 'vanille', style }: { children: ReactNode; tone?: Tone; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[s.sec, { color: TONE(colors)[tone].sub }, style]}>{children}</Text>;
}

/** Pastille sticker (statut, compteur, étiquette). */
export function Chip({ label, tone = 'vanille', icon, rotate, size = 'md', style }: { label: string; tone?: ButtonTone; icon?: IconName; rotate?: number; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  const { colors, isDark } = useTheme();
  const c = tone === 'vanille' ? { bg: colors.card, fg: colors.ink } : BTN(colors, isDark)[tone];
  const sm = size === 'sm';
  const inner = (
    <View style={[s.chip, sm && { paddingVertical: 3, paddingHorizontal: 8, gap: 3 }]}>
      {icon && <Icon name={icon} size={sm ? 13 : 16} color={icon === 'scoop' ? colors.cerise : c.fg} />}
      <Text style={[s.chipT, { color: c.fg }, sm && { fontSize: 12 }]}>{label}</Text>
    </View>
  );
  return (
    <View style={[{ alignSelf: 'flex-start' }, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]}>
      <View style={{ borderRadius: 999, borderWidth: tone === 'white' ? 1 : 0, borderColor: colors.line, backgroundColor: tone === 'vanille' ? colors.card : c.bg, overflow: 'hidden' }}>{tone === 'holo' ? <HoloFill>{inner}</HoloFill> : inner}</View>
    </View>
  );
}

/** Série : pastille avec la goutte de la marque (cerise quand la série est en danger). */
export function StreakPill({ days, atRisk }: { days: number; atRisk?: boolean }) {
  return <Chip size="sm" tone={atRisk ? 'cerise' : 'vanille'} icon={atRisk ? 'melt' : 'scoop'} label={String(days)} style={{ alignSelf: 'center' }} />;
}

/** Avatar : la photo de profil si la personne en a une, sinon son initiale sur son parfum. `ring` : liseré vanille (sur photo). */
export function Avatar({ name, uri, size = 38, ring }: { name: string; uri?: string | null; size?: number; ring?: boolean }) {
  const box = { width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 2 : 0, borderColor: colors.vanille };
  if (uri) return <Image source={{ uri }} style={[box, { backgroundColor: avatarColor(name) }]} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />;
  return (
    <View style={[box, { backgroundColor: avatarColor(name), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontFamily: fonts.display, includeFontPadding: false, fontSize: size * 0.5, color: colors.cacao, marginTop: size * 0.04 }} allowFontScaling={false}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Ligne de liste sans cadre (ami, envoi). */
export function Row({ children, onPress, onLongPress, style, active, accessibilityLabel, accessibilityRole, accessibilityState }: { children: ReactNode; onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; active?: boolean } & Pick<PressableProps, 'accessibilityLabel' | 'accessibilityRole' | 'accessibilityState'>) {
  const th = useStyles(themed);
  const box = [s.row, active && th.rowOn, style];
  if (!onPress) return <View style={box}>{children}</View>;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityRole ?? 'button'} accessibilityState={accessibilityState} style={({ pressed }) => [box, pressed && { transform: [{ scale: 0.98 }] }]}>
      {children}
    </Pressable>
  );
}

/** Case à cocher carrée cacao. */
export function Check({ on }: { on: boolean }) {
  const { colors } = useTheme();
  const th = useStyles(themed);
  return (
    <View style={[th.check, on && { backgroundColor: colors.cerise, borderColor: colors.cerise }]}>
      {on && <Icon name="check" size={14} color={colors.white} stroke={3.2} />}
    </View>
  );
}

/** Interrupteur aux couleurs de la DA. */
export function Toggle({ value, onValueChange, label, disabled }: { value: boolean; onValueChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const { colors } = useTheme();
  return <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{ true: colors.cerise, false: colors.sand }} thumbColor={colors.white} {...({ activeThumbColor: colors.white } as object)} ios_backgroundColor={colors.sand} />;
}

type FieldProps = TextInputProps & { label: string; hint?: string; tone?: Tone; prefix?: string; right?: ReactNode; error?: boolean };

/** Champ de saisie : carte blanche au trait sable, cacao quand on écrit dedans. */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, hint, tone = 'vanille', style, onFocus, onBlur, prefix, right, error, ...rest }, ref) {
  const { colors } = useTheme();
  const th = useStyles(themed);
  const [focus, setFocus] = useState(false);
  const c = TONE(colors)[tone];
  return (
    <View style={{ gap: 7 }}>
      <Text style={[s.fieldL, { color: c.fg }]}>{label}</Text>
      <View style={[th.fieldBox, focus && { borderColor: colors.ink }, error && { borderColor: colors.cerise }]}>
      {prefix ? <Text style={th.prefix}>{prefix}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.cerise}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={[th.field, prefix ? { paddingLeft: 2 } : null, style]}
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
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'vanille' ? colors.card : 'rgba(255,247,242,0.14)', borderWidth: tone === 'vanille' ? 1 : 0, borderColor: colors.line }}>
      <Icon name={icon} size={size * 0.42} color={tone === 'vanille' ? colors.cerise : colors.vanille} stroke={2.2} />
    </View>
  );
}

/** État vide : une icône, une phrase, une action. */
export function Empty({ art, title, body, action }: { art?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  const th = useStyles(themed);
  return (
    <View style={s.empty}>
      {art ? <View style={{ alignItems: 'center', marginBottom: 4 }}>{art}</View> : null}
      <Title size={28} style={{ textAlign: 'center' }}>
        {title}
      </Title>
      {body ? <Text style={th.emptyB}>{body}</Text> : null}
      {action}
    </View>
  );
}

// Styles sans couleur d'interface : identiques en clair et en sombre.
const s = StyleSheet.create({
  head: { height: layout.headerHeight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  side: { width: 64 },
  mid: { flex: 1, alignItems: 'center' },
  headT: { fontFamily: fonts.display, includeFontPadding: false, fontSize: 23, letterSpacing: -0.4 },
  top: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnT: { ...tx.black, letterSpacing: -0.2 },
  cta: { paddingHorizontal: 20, paddingTop: 10 },
  sec: { ...tx.bold, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 13 },
  chipT: { ...tx.black, fontSize: 13.5 },
  // lignes aérées, sans cadre : l'avatar et le nom portent la ligne ; la sélection se voit par un fond doux
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 22 },
  fieldL: { ...tx.bold, fontSize: 14 },
  fieldRight: { paddingRight: 12, paddingLeft: 4 },
  hint: { ...tx.text, fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 32 },
});

// Styles qui portent une couleur d'interface : recalculés quand le mode change.
const themed = (colors: Palette) =>
  StyleSheet.create({
    iconLight: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
    rowOn: { backgroundColor: colors.card },
    check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.dashed, alignItems: 'center', justifyContent: 'center' },
    fieldBox: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
    field: { flex: 1, height: '100%', paddingHorizontal: 16, ...tx.bold, fontSize: 17, color: colors.ink },
    prefix: { ...tx.black, fontSize: 17, color: colors.muted, paddingLeft: 16 },
    emptyB: { ...tx.text, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  });
