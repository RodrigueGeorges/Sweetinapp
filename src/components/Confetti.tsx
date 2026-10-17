import { Canvas, createPicture, Picture, Skia, useClock } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, useReducedMotion } from 'react-native-reanimated';

// la palette des confettis de la DA : ronds, bâtonnets, losanges
const COLORS = ['#FFFFFF', '#FFE6EB', '#E8FF5A', '#160F12', '#FFFFFF', '#FFE6EB']; // blanc, sucre, citron, nuit

/** Explosion de confettis dessinée sur le GPU, une seule fois au montage. */
export function Confetti({ width, height, originY = 0.42, count = 90 }: { width: number; height: number; originY?: number; count?: number }) {
  const reduce = useReducedMotion();
  const clock = useClock();
  const [pieces] = useState(() =>
    Array.from({ length: count }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const v = 6 + Math.random() * 9;
      return {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 3,
        shape: Math.floor(Math.random() * 3), // bâtonnet, rond, losange
        spin: (Math.random() - 0.5) * 0.4,
        c: Math.floor(Math.random() * COLORS.length),
        life: 1400 + Math.random() * 900,
      };
    }),
  );
  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      const ms = clock.value;
      const paint = Skia.Paint();
      const ox = width / 2;
      const oy = height * originY;
      for (const p of pieces) {
        const age = ms / p.life;
        if (age > 1) continue;
        const t = ms / 16;
        const drag = Math.pow(0.985, t);
        const x = ox + p.vx * t * drag;
        const y = oy + p.vy * t * drag + 0.09 * t * t;
        paint.setColor(Skia.Color(COLORS[p.c]));
        paint.setAlphaf(1 - age * age);
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate((p.spin * t * 180) / Math.PI, 0, 0);
        if (p.shape === 1) canvas.drawCircle(0, 0, p.h, paint);
        else if (p.shape === 2) {
          canvas.rotate(45, 0, 0);
          canvas.drawRect(Skia.XYWHRect(-p.h, -p.h, p.h * 2, p.h * 2), paint);
        } else canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(-p.w / 2, -p.h / 2, p.w, p.h), p.h / 2, p.h / 2), paint);
        canvas.restore();
      }
    }),
  );
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}
