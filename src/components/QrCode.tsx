import QRCode from 'qrcode';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** QR code dessiné en vecteur (net à toutes les tailles), sans dépendance native. */
export function QrCode({ value, size = 200, color = '#FF2E5B', background = '#FFFFFF' }: { value: string; size?: number; color?: string; background?: string }) {
  const { d, n } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    let path = '';
    for (let y = 0; y < count; y++)
      for (let x = 0; x < count; x++) if (qr.modules.get(x, y)) path += `M${x + 2} ${y + 2}h1v1h-1z`;
    return { d: path, n: count + 4 };
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessibilityRole="image">
      <Rect x={0} y={0} width={n} height={n} fill={background} rx={2} />
      <Path d={d} fill={color} />
    </Svg>
  );
}
