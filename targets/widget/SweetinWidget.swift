import SwiftUI
import WidgetKit

// Le groupe d'apps est écrit par l'app (src/lib/widget.tsx) : compteur, prénom et textes déjà traduits.
// Aucune photo ni aucun message ne quitte l'app.
private func appGroup() -> String {
  let bundle = Bundle.main.bundleIdentifier ?? "app.sweetin.ios.SweetinWidget"
  let appBundle = bundle.components(separatedBy: ".").dropLast().joined(separator: ".")
  return "group.\(appBundle)"
}

struct SweetEntry: TimelineEntry {
  let date: Date
  let count: Int
  let title: String
  let subtitle: String
  let cta: String
  let preview: UIImage?
}

struct SweetProvider: TimelineProvider {
  private func read() -> SweetEntry {
    let d = UserDefaults(suiteName: appGroup())
    let fr = Locale.current.language.languageCode?.identifier == "fr"
    return SweetEntry(
      date: .now,
      count: d?.integer(forKey: "count") ?? 0,
      title: d?.string(forKey: "title") ?? (fr ? "rien à gratter." : "nothing to scratch."),
      subtitle: d?.string(forKey: "subtitle") ?? (fr ? "envoie le premier sweet" : "send the first sweet"),
      cta: d?.string(forKey: "cta") ?? "send a sweet",
      // vignette de 24 px du dernier flip reçu : floutée à l'affichage, on devine sans voir
      preview: d?.string(forKey: "preview").flatMap { Data(base64Encoded: $0) }.flatMap { UIImage(data: $0) }
    )
  }
  func placeholder(in context: Context) -> SweetEntry {
    SweetEntry(date: .now, count: 2, title: "2 sweets", subtitle: "", cta: "send a sweet", preview: nil)
  }
  func getSnapshot(in context: Context, completion: @escaping (SweetEntry) -> Void) { completion(read()) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<SweetEntry>) -> Void) {
    // l'app recharge le widget à chaque changement ; on relit aussi toutes les 30 min par sécurité
    completion(Timeline(entries: [read()], policy: .after(.now.addingTimeInterval(1800))))
  }
}

// DA « net + éclats » : le fond de l'écran (blanc, nuit en sombre), la carte photo de la vitrine
// (photo floutée sous le sucre givré, bas qui coule, « gratte. »), la glace framboise et le compteur citron en éclats.
struct SweetWidgetView: View {
  var entry: SweetEntry
  @Environment(\.widgetFamily) var family

  private var hasSweet: Bool { entry.count > 0 }

  var body: some View {
    Group {
      if hasSweet {
        if family == .systemSmall { smallCard } else { mediumCard }
      } else {
        empty
      }
    }
    .widgetURL(URL(string: "sweetin://inbox"))
    .containerBackground(for: .widget) { Color("paper") }
  }

  // La carte de la vitrine, en petit : photo floutée, sucre, « gratte. », le bas qui coule.
  private func card(scratch: CGFloat) -> some View {
    GeometryReader { geo in
      ZStack(alignment: .topLeading) {
        if let img = entry.preview {
          Image(uiImage: img).resizable().scaledToFill().blur(radius: 10).scaleEffect(1.25)
            .frame(width: geo.size.width, height: geo.size.height).clipped()
        } else {
          LinearGradient(colors: [Color("sucre"), Color("citron").opacity(0.5)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
        Color.white.opacity(0.12)
        Image("sucre").resizable(resizingMode: .tile).opacity(0.62)
        Text(scratchWord)
          .font(.custom("SweetinDisplay", size: scratch, relativeTo: .title))
          .foregroundStyle(.white)
          .shadow(color: Color("cacao").opacity(0.35), radius: 10, y: 2)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .offset(y: -geo.size.width * 0.06)
        HStack {
          IceMark(scoop: .white, cone: Color("cacao")).frame(height: 24)
          Spacer()
          countChip
        }
        .padding(10)
        VStack {
          Spacer()
          DripEdgeInverse().fill(Color("paper")).frame(height: geo.size.width * 0.205)
        }
      }
      .clipShape(UnevenRoundedRectangle(topLeadingRadius: 18, topTrailingRadius: 18))
    }
  }

  private var scratchWord: String { Locale.current.language.languageCode?.identifier == "fr" ? "gratte." : "scratch." }

  private var countChip: some View {
    Text("\(entry.count)")
      .font(.custom("SweetinText-ExtraBold", size: 13, relativeTo: .caption))
      .foregroundStyle(Color("cacao"))
      .padding(.horizontal, 8).padding(.vertical, 2)
      .background(Color("citron"), in: Capsule())
      .overlay(Capsule().stroke(.white, lineWidth: 2))
      .contentTransition(.numericText())
  }

  private var smallCard: some View {
    VStack(alignment: .leading, spacing: 4) {
      card(scratch: 24)
      Text(entry.title)
        .font(.custom("SweetinText-ExtraBold", size: 12, relativeTo: .caption))
        .foregroundStyle(Color("ink")).lineLimit(1).minimumScaleFactor(0.8)
    }
  }

  private var mediumCard: some View {
    HStack(spacing: 14) {
      card(scratch: 26).aspectRatio(0.86, contentMode: .fit)
      VStack(alignment: .leading, spacing: 4) {
        Spacer(minLength: 0)
        Text(entry.title)
          .font(.custom("SweetinDisplay", size: 17, relativeTo: .title3))
          .foregroundStyle(Color("ink")).lineLimit(2).minimumScaleFactor(0.8)
        Text(entry.subtitle)
          .font(.custom("SweetinText-ExtraBold", size: 12, relativeTo: .caption))
          .foregroundStyle(Color("ink").opacity(0.6)).lineLimit(1)
        Spacer(minLength: 0)
        cta
      }
    }
  }

  // Rien à gratter : la glace framboise, le titre, et le bouton nuit pour envoyer le premier sweet.
  private var empty: some View {
    VStack(alignment: .leading, spacing: 4) {
      IceMark(scoop: Color("cerise"), cone: Color("ink")).frame(height: 30)
      Spacer(minLength: 0)
      Text(entry.title)
        .font(.custom("SweetinDisplay", size: family == .systemSmall ? 16 : 19, relativeTo: .title2))
        .foregroundStyle(Color("ink")).lineLimit(2).minimumScaleFactor(0.8)
      Text(entry.subtitle)
        .font(.custom("SweetinText-ExtraBold", size: 12, relativeTo: .caption))
        .foregroundStyle(Color("ink").opacity(0.6)).lineLimit(1)
      cta.padding(.top, 4)
    }
  }

  private var cta: some View {
    Link(destination: URL(string: "sweetin://camera")!) {
      Text(entry.cta)
        .font(.custom("SweetinText-ExtraBold", size: 14, relativeTo: .body))
        .foregroundStyle(Color("paper"))
        .lineLimit(1).minimumScaleFactor(0.8)
        .frame(maxWidth: .infinity).padding(.vertical, 7)
        .background(Color("ink"), in: Capsule())
    }
  }
}

struct SweetinWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SweetinWidget", provider: SweetProvider()) { entry in
      SweetWidgetView(entry: entry)
    }
    .configurationDisplayName("Sweetin")
    .description("Tes sweets à gratter, et un raccourci pour en envoyer un.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct SweetinWidgets: WidgetBundle {
  var body: some Widget { SweetinWidget() }
}
