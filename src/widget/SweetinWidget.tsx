import { LOGO_DRIPS, LOGO_VIEWBOX as V, LOGO_WORD } from '../components/logoPath';
import { FlexWidget, SvgWidget, ImageWidget, OverlapWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetState } from '../lib/widget';

/** Le logo « sweetin. » en blanc (même tracé que dans l'app). */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${V.x} ${V.y} ${V.w} ${V.h}"><path fill="#FFFFFF" d="${LOGO_WORD} ${LOGO_DRIPS}"/></svg>`;

/**
 * Widget Android dans la DA 2027 : fond cerise, compteur pistache, bouton vanille « send a flip ».
 * Toucher le haut ouvre les notifications, le bouton ouvre l'appareil photo.
 */
export function SweetinWidget({ count, title, subtitle, cta, preview }: WidgetState) {
  const content = (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        borderRadius: 24,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundGradient: preview && count > 0 ? { from: 'rgba(255, 45, 95, 0.8)', to: 'rgba(235, 22, 80, 0.92)', orientation: 'TL_BR' } : { from: '#FF4473', to: '#EB1650', orientation: 'TL_BR' },
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'sweetin://inbox' }}
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'match_parent' }}>
        <SvgWidget svg={LOGO_SVG} style={{ width: 96, height: 20 }} />
        {count > 0 ? (
          <FlexWidget style={{ backgroundColor: '#C5EE6A', borderRadius: 12, borderWidth: 2, borderColor: '#1A0A0E', paddingHorizontal: 8, paddingVertical: 1 }}>
            <TextWidget text={String(count)} style={{ fontFamily: 'SweetinText-ExtraBold', fontSize: 13, color: '#1A0A0E' }} />
          </FlexWidget>
        ) : null}
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget text={title} maxLines={2} style={{ fontFamily: 'SweetinDisplay', fontSize: 22, color: '#FFF4E6' }} />
        <TextWidget text={subtitle} maxLines={1} style={{ fontFamily: 'SweetinText-ExtraBold', fontSize: 12, color: '#1A0A0E' }} />
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'sweetin://camera' }}
        style={{ backgroundColor: '#FFF4E6', borderRadius: 18, borderWidth: 2, borderColor: '#1A0A0E', paddingVertical: 6, width: 'match_parent', alignItems: 'center' }}
      >
        <TextWidget text={cta} style={{ fontFamily: 'SweetinText-ExtraBold', fontSize: 14, color: '#1A0A0E' }} />
      </FlexWidget>
    </FlexWidget>
  );
  if (!preview || count === 0) return content;
  // la vignette floue du dernier flip, en fond, sous un voile cerise : on devine, on ne voit pas
  return (
    <OverlapWidget style={{ height: 'match_parent', width: 'match_parent', borderRadius: 24 }}>
      <ImageWidget image={`data:image/jpeg;base64,${preview}`} imageWidth={160} imageHeight={160} resizeMode="cover" radius={24} style={{ height: 'match_parent', width: 'match_parent' }} />
      {content}
    </OverlapWidget>
  );
}
