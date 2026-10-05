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
      subtitle: d?.string(forKey: "subtitle") ?? (fr ? "envoie le premier flip" : "send the first flip"),
      cta: d?.string(forKey: "cta") ?? "send a flip",
      // vignette de 24 px du dernier flip reçu : floutée à l'affichage, on devine sans voir
      preview: d?.string(forKey: "preview").flatMap { Data(base64Encoded: $0) }.flatMap { UIImage(data: $0) }
    )
  }
  func placeholder(in context: Context) -> SweetEntry {
    SweetEntry(date: .now, count: 2, title: "2 flips", subtitle: "", cta: "send a flip", preview: nil)
  }
  func getSnapshot(in context: Context, completion: @escaping (SweetEntry) -> Void) { completion(read()) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<SweetEntry>) -> Void) {
    // l'app recharge le widget à chaque changement ; on relit aussi toutes les 30 min par sécurité
    completion(Timeline(entries: [read()], policy: .after(.now.addingTimeInterval(1800))))
  }
}

// DA 2027 : fond cerise, logo qui fond (vanille), compteur pistache, bouton vanille au trait cacao.
struct SweetWidgetView: View {
  var entry: SweetEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Image("logo").resizable().scaledToFit().frame(height: 24).accessibilityLabel("Sweetin")
        Spacer()
        if entry.count > 0 {
          Text("\(entry.count)")
            .font(.custom("SweetinText-ExtraBold", size: 13, relativeTo: .caption))
            .foregroundStyle(Color("cacao"))
            .padding(.horizontal, 8).padding(.vertical, 2)
            .background(Color("pistache"), in: Capsule())
            .overlay(Capsule().stroke(Color("cacao"), lineWidth: 2))
            .contentTransition(.numericText())
        }
      }
      Spacer(minLength: 0)
      Text(entry.title)
        .font(.custom("SweetinDisplay", size: family == .systemSmall ? 22 : 26, relativeTo: .title2))
        .foregroundStyle(Color("vanille")).lineLimit(2).minimumScaleFactor(0.8)
      Text(entry.subtitle).font(.custom("SweetinText-ExtraBold", size: 12, relativeTo: .caption)).foregroundStyle(Color("cacao")).lineLimit(1)
      Link(destination: URL(string: "sweetin://camera")!) {
        Text(entry.cta)
          .font(.custom("SweetinText-ExtraBold", size: 14, relativeTo: .body))
          .foregroundStyle(Color("cacao"))
          .frame(maxWidth: .infinity).padding(.vertical, 6)
          .background(Color("vanille"), in: Capsule())
          .overlay(Capsule().stroke(Color("cacao"), lineWidth: 2))
      }
    }
    .widgetURL(URL(string: "sweetin://inbox"))
    .containerBackground(for: .widget) {
      ZStack {
        if entry.count > 0, let img = entry.preview {
          Image(uiImage: img).resizable().scaledToFill().blur(radius: 10).scaleEffect(1.2)
          LinearGradient(colors: [Color("ceriseTop").opacity(0.8), Color("ceriseBottom").opacity(0.92)], startPoint: .topLeading, endPoint: .bottomTrailing)
        } else {
          LinearGradient(colors: [Color("ceriseTop"), Color("cerise"), Color("ceriseBottom")], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
      }
    }
  }
}

struct SweetinWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SweetinWidget", provider: SweetProvider()) { entry in
      SweetWidgetView(entry: entry)
    }
    .configurationDisplayName("Sweetin")
    .description("Tes flips à gratter, et un raccourci pour en envoyer un.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct SweetinWidgets: WidgetBundle {
  var body: some Widget { SweetinWidget() }
}
