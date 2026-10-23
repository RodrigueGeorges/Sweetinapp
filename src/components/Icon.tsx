import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Platform } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { ICE_CONE_MINI, ICE_SCOOP_MINI, ICE_VIEWBOX } from './logoPath';
import { colors } from '../theme';

/** Icônes au trait de la DA : trait épais et rond, jamais d'emoji en guise d'icône. */
export type IconName =
  | 'back'
  | 'chevronDown'
  | 'close'
  | 'check'
  | 'arrow'
  | 'link'
  | 'story'
  | 'users'
  | 'userPlus'
  | 'scan'
  | 'qr'
  | 'clipboard'
  | 'phone'
  | 'hourglass'
  | 'flame'
  | 'scoop'
  | 'melt'
  | 'lock'
  | 'eye'
  | 'eyeOff'
  | 'flash'
  | 'flashOff'
  | 'search'
  | 'share'
  | 'settings'
  | 'inbox'
  | 'person'
  | 'gallery'
  | 'flipCam'
  | 'retake'
  | 'more'
  | 'send'
  | 'hand'
  | 'snap'
  | 'sparkle'
  | 'message';

type Props = { name: IconName; size?: number; color?: string; stroke?: number };

/**
 * Icônes système : SF Symbols sur iOS, Material Symbols sur Android (nettes, animables, familières).
 * Les icônes de marque (glace) et le web gardent le dessin maison.
 */
const SYMBOLS: Partial<Record<IconName, { ios: string; android: string }>> = {
  back: { ios: 'chevron.left', android: 'arrow_back' },
  chevronDown: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  close: { ios: 'xmark', android: 'close' },
  check: { ios: 'checkmark', android: 'check' },
  arrow: { ios: 'arrow.right', android: 'arrow_forward' },
  link: { ios: 'link', android: 'link' },
  story: { ios: 'circle.circle', android: 'motion_photos_on' },
  users: { ios: 'person.2', android: 'group' },
  userPlus: { ios: 'person.badge.plus', android: 'person_add' },
  scan: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
  qr: { ios: 'qrcode', android: 'qr_code_2' },
  clipboard: { ios: 'doc.on.clipboard', android: 'content_paste' },
  phone: { ios: 'iphone', android: 'smartphone' },
  hourglass: { ios: 'hourglass', android: 'hourglass_top' },
  lock: { ios: 'lock.fill', android: 'lock' },
  eye: { ios: 'eye', android: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off' },
  flash: { ios: 'bolt.fill', android: 'flash_on' },
  flashOff: { ios: 'bolt.slash', android: 'flash_off' },
  search: { ios: 'magnifyingglass', android: 'search' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  settings: { ios: 'gearshape', android: 'settings' },
  inbox: { ios: 'tray', android: 'inbox' },
  person: { ios: 'person.crop.circle', android: 'person' },
  gallery: { ios: 'photo.on.rectangle', android: 'photo_library' },
  flipCam: { ios: 'arrow.triangle.2.circlepath.camera', android: 'flip_camera_ios' },
  retake: { ios: 'arrow.counterclockwise', android: 'replay' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  send: { ios: 'paperplane.fill', android: 'send' },
  hand: { ios: 'hand.point.up.left.fill', android: 'touch_app' },
  snap: { ios: 'camera.fill', android: 'photo_camera' },
  sparkle: { ios: 'sparkles', android: 'auto_awesome' },
  message: { ios: 'bubble.left.fill', android: 'chat_bubble' },
};

export function Icon({ name, size = 22, color = colors.ink, stroke = 2.4 }: Props) {
  const sym = Platform.OS !== 'web' ? SYMBOLS[name] : undefined;
  if (sym) {
    const weight = stroke >= 2.6 ? 'bold' : stroke >= 2.2 ? 'semibold' : 'medium';
    return (
      <SymbolView
        name={sym as unknown as SymbolViewProps['name']}
        size={size}
        tintColor={color}
        weight={weight}
        resizeMode="scaleAspectFit"
        fallback={<SvgIcon name={name} size={size} color={color} stroke={stroke} />}
      />
    );
  }
  return <SvgIcon name={name} size={size} color={color} stroke={stroke} />;
}

/** Le dessin maison : web, icônes de marque, et repli si un symbole manque. */
function SvgIcon({ name, size = 22, color = colors.ink, stroke = 2.4 }: Props) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const body = (() => {
    switch (name) {
      case 'back':
        return <Path {...p} d="M15 5 8 12l7 7" />;
      case 'chevronDown':
        return <Path {...p} d="M5 9l7 7 7-7" />;
      case 'close':
        return <Path {...p} d="M6 6l12 12M18 6 6 18" />;
      case 'check':
        return <Path {...p} d="M4.5 12.5 9.5 17.5 19.5 6.5" />;
      case 'arrow':
        return <Path {...p} d="M4 12h15M13 6l6 6-6 6" />;
      case 'link':
        return (
          <>
            <Path {...p} d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
            <Path {...p} d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
          </>
        );
      case 'story':
        return (
          <>
            <Circle {...p} cx={12} cy={12} r={8.5} strokeDasharray="4 3" />
            <Circle cx={12} cy={12} r={3.5} fill={color} />
          </>
        );
      case 'users':
        return (
          <>
            <Circle {...p} cx={9} cy={8.5} r={3.5} />
            <Path {...p} d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
            <Path {...p} d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.4c2 .8 3.5 2.8 3.5 5.6" />
          </>
        );
      case 'userPlus':
        return (
          <>
            <Circle {...p} cx={10} cy={8.5} r={3.8} />
            <Path {...p} d="M3 20c0-3.8 3.1-6.2 7-6.2 1.6 0 3 .4 4.2 1.1" />
            <Path {...p} d="M18.5 13.5v7M15 17h7" />
          </>
        );
      case 'scan':
        return (
          <>
            <Path {...p} d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
            <Path {...p} d="M8 12h8" />
          </>
        );
      case 'qr':
        return (
          <>
            <Rect {...p} x={4} y={4} width={6} height={6} rx={1.2} />
            <Rect {...p} x={14} y={4} width={6} height={6} rx={1.2} />
            <Rect {...p} x={4} y={14} width={6} height={6} rx={1.2} />
            <Path {...p} d="M14 14h2.5v2.5M20 14v.01M14 20h.01M17.5 20H20v-2.5" />
          </>
        );
      case 'clipboard':
        return (
          <>
            <Rect {...p} x={5} y={4.5} width={14} height={16} rx={2.5} />
            <Path {...p} d="M9 4.5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7M9 11h6M9 15h4" />
          </>
        );
      case 'phone':
        return (
          <>
            <Rect {...p} x={6.5} y={2.5} width={11} height={19} rx={2.5} />
            <Path {...p} d="M11 18.5h2" />
          </>
        );
      case 'hourglass':
        return <Path {...p} d="M6.5 3h11M6.5 21h11M7.5 3c0 5 9 5 9 9s-9 4-9 9M16.5 3c0 5-9 5-9 9s9 4 9 9" />;
      // la glace de la marque (même dessin que l'icône de l'app)
      case 'scoop':
      case 'melt':
        return (
          <G transform={`translate(12 12) scale(${21 / ICE_VIEWBOX.h}) translate(${-(ICE_VIEWBOX.x + ICE_VIEWBOX.w / 2)} ${-(ICE_VIEWBOX.y + ICE_VIEWBOX.h / 2)})`}>
            <Path d={ICE_CONE_MINI} fill={color} />
            <Path d={ICE_SCOOP_MINI} fill={color} />
          </G>
        );
      case 'flame':
        return (
          <>
            <Path d="M12 1.5c1 4.5 6.5 7 6.5 13a6.5 6.5 0 0 1-13 0c0-3.6 1.8-5.5 2.8-7.3.9 2.7 1.9 3.6 2.8 3.6-.9-3.6 0-7.2.9-9.3z" fill={color} />
            <Path d="M12 13c.9 2.7 3.6 3.6 3.6 7.2a3.6 3.6 0 0 1-7.2 0c0-1.8.9-2.7 1.8-3.6 0 .9.9 1.8 1.8 1.8-.5-1.8 0-3.6 0-5.4z" fill={colors.lemon} />
          </>
        );
      case 'lock':
        return (
          <>
            <Rect {...p} x={5} y={10.5} width={14} height={10} rx={2.5} />
            <Path {...p} d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          </>
        );
      case 'eye':
        return (
          <>
            <Path {...p} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
            <Circle {...p} cx={12} cy={12} r={3} />
          </>
        );
      case 'eyeOff':
        return (
          <>
            <Path {...p} d="M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 5.4-1.6" />
            <Path {...p} d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3.5 3.5l17 17" />
          </>
        );
      case 'flash':
        return <Path {...p} d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" fill={color} />;
      case 'flashOff':
        return (
          <>
            <Path {...p} d="M13 2.5 10.6 6M16.4 12.2 18 10.5h-4.5M11 13.5H5L8 9.4M10 21.5l1-8M3.5 3.5l17 17" />
          </>
        );
      case 'search':
        return (
          <>
            <Circle {...p} cx={11} cy={11} r={6.5} />
            <Path {...p} d="m20 20-4.2-4.2" />
          </>
        );
      case 'share':
        return <Path {...p} d="M12 3.5v11M7.5 8 12 3.5 16.5 8M5 13.5v4.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5" />;
      case 'settings':
        return (
          <>
            <Circle {...p} cx={12} cy={12} r={3} />
            <Path {...p} d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
          </>
        );
      case 'inbox':
        return (
          <>
            <Path {...p} d="M3 13.5 5.6 5.8A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.3L21 13.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <Path {...p} d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5" />
          </>
        );
      case 'person':
        return (
          <>
            <Circle {...p} cx={12} cy={8} r={4} />
            <Path {...p} d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
          </>
        );
      case 'gallery':
        return (
          <>
            <Rect {...p} x={3.5} y={4.5} width={17} height={15} rx={3} />
            <Circle cx={9} cy={9.5} r={1.8} fill={color} />
            <Path {...p} d="m4 17 4.5-4.5 3.5 3.5 2.5-2.5 5.5 5" />
          </>
        );
      case 'flipCam':
        return (
          <>
            <Path {...p} d="M4 9a8.5 8.5 0 0 1 15.2-2.6M20 15a8.5 8.5 0 0 1-15.2 2.6" />
            <Path {...p} d="M19.5 3v4h-4M4.5 21v-4h4" />
          </>
        );
      case 'retake':
        return (
          <>
            <Path {...p} d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
            <Path {...p} d="M4.5 3.5v4h4" />
          </>
        );
      case 'more':
        return (
          <>
            <Circle cx={5.5} cy={12} r={2} fill={color} />
            <Circle cx={12} cy={12} r={2} fill={color} />
            <Circle cx={18.5} cy={12} r={2} fill={color} />
          </>
        );
      case 'send':
        return <Path {...p} d="M21 3 3.5 10.5l7 2.8M21 3l-7.5 17.5-3-7.2M21 3 10.5 13.3" />;
      case 'hand':
        return <Path {...p} d="M9 11V5a2 2 0 0 1 4 0v6M13 9a2 2 0 0 1 4 0v3M17 11a2 2 0 0 1 3 1.7V16a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L5 15a2 2 0 0 1 3.2-2.3L9 14" />;
      case 'snap':
        return (
          <>
            <Path {...p} d="M4 8.5A2 2 0 0 1 6 6.5h2l1.6-2.2h4.8L16 6.5h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
            <Circle {...p} cx={12} cy={12.5} r={3.5} />
          </>
        );
      case 'sparkle':
        return <Path d="M12 2.5c.8 5 4.4 8.6 9.5 9.5-5.1.9-8.7 4.5-9.5 9.5-.8-5-4.4-8.6-9.5-9.5 5.1-.9 8.7-4.5 9.5-9.5z" fill={color} />;
      case 'message':
        return <Path {...p} d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9L6.5 21v-3.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z" />;
    }
  })();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
