import {
  ICE_CONE_MINI,
  ICE_SCOOP_MINI,
  ICE_VIEWBOX as V,
} from "../components/logoPath";
import {
  FlexWidget,
  SvgWidget,
  ImageWidget,
  OverlapWidget,
  TextWidget,
} from "react-native-android-widget";
import { t } from "../i18n";
import type { WidgetState } from "../lib/widget";

const PAPER = "#FFFFFF";
const INK = "#160F12";
const FRAMBOISE = "#FF2E5B";
const CITRON = "#E8FF5A";

/** La glace de la marque (même tracé que dans l'app, version mini). */
const mark = (scoop: string, cone: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${V.x} ${V.y} ${V.w} ${V.h}"><path fill="${cone}" d="${ICE_CONE_MINI}"/><path fill="${scoop}" d="${ICE_SCOOP_MINI}"/></svg>`;
/** Le bord qui coule, peint dans la couleur du fond sur le bas de la carte. */

/**
 * Widget Android, DA « net + éclats » : fond blanc, la carte photo de la vitrine (photo floutée sous un voile de sucre,
 * « gratte. », le bas qui coule), la glace framboise et le compteur citron en éclats, le bouton nuit.
 * Toucher la carte ouvre la vitrine, le bouton ouvre l'appareil photo.
 */
export function SweetinWidget({
  count,
  title,
  subtitle,
  cta,
  preview,
}: WidgetState) {
  const button = (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "sweetin://camera" }}
      style={{
        backgroundColor: INK,
        borderRadius: 18,
        paddingVertical: 7,
        width: "match_parent",
        alignItems: "center",
      }}
    >
      <TextWidget
        text={cta}
        maxLines={1}
        style={{
          fontFamily: "SweetinText-ExtraBold",
          fontSize: 14,
          color: PAPER,
        }}
      />
    </FlexWidget>
  );

  if (count === 0 || !preview) {
    return (
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          borderRadius: 24,
          padding: 14,
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: PAPER,
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: "sweetin://inbox" }}
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "match_parent",
          }}
        >
          <SvgWidget
            svg={mark(FRAMBOISE, INK)}
            style={{ width: 20, height: 30 }}
          />
          {count > 0 ? <Count n={count} /> : null}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: "column" }}>
          <TextWidget
            text={title}
            maxLines={2}
            style={{ fontFamily: "SweetinDisplay", fontSize: 16, color: INK }}
          />
          <TextWidget
            text={subtitle}
            maxLines={1}
            style={{
              fontFamily: "SweetinText-ExtraBold",
              fontSize: 12,
              color: "rgba(22, 15, 18, 0.6)",
            }}
          />
        </FlexWidget>
        {button}
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        borderRadius: 24,
        padding: 10,
        flexDirection: "column",
        backgroundColor: PAPER,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: "sweetin://inbox" }}
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <FlexWidget style={{ width: "match_parent", flex: 1 }}>
        <OverlapWidget
          style={{ height: "match_parent", width: "match_parent" }}
        >
          <ImageWidget
            image={`data:image/jpeg;base64,${preview}`}
            imageWidth={160}
            imageHeight={160}
            resizeMode="cover"
            radius={18}
            style={{ height: "match_parent", width: "match_parent" }}
          />
          <FlexWidget
            style={{
              height: "match_parent",
              width: "match_parent",
              borderRadius: 18,
              backgroundColor: "rgba(255, 255, 255, 0.28)",
            }}
          />
          <FlexWidget
            style={{
              height: "match_parent",
              width: "match_parent",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <FlexWidget
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: "match_parent",
                padding: 8,
              }}
            >
              <SvgWidget
                svg={mark("#FFFFFF", INK)}
                style={{ width: 16, height: 24 }}
              />
              <Count n={count} />
            </FlexWidget>
            <FlexWidget style={{ width: "match_parent", alignItems: "center" }}>
              <TextWidget
                text={t("inbox.scratch")}
                style={{
                  fontFamily: "SweetinDisplay",
                  fontSize: 24,
                  color: "#FFFFFF",
                }}
              />
            </FlexWidget>
            <FlexWidget style={{ height: 12 }} />
          </FlexWidget>
        </OverlapWidget>
      </FlexWidget>
      <TextWidget
        text={title}
        maxLines={1}
        style={{
          fontFamily: "SweetinText-ExtraBold",
          fontSize: 12,
          color: INK,
          marginTop: 2,
        }}
      />
    </FlexWidget>
  );
}

function Count({ n }: { n: number }) {
  return (
    <FlexWidget
      style={{
        backgroundColor: CITRON,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 1,
        borderWidth: 2,
        borderColor: "#FFFFFF",
      }}
    >
      <TextWidget
        text={String(n)}
        style={{
          fontFamily: "SweetinText-ExtraBold",
          fontSize: 13,
          color: INK,
        }}
      />
    </FlexWidget>
  );
}
