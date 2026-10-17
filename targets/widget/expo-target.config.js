/** Widget iOS « Sweetin » (WidgetKit). Les données viennent de l'app via le groupe d'apps partagé. */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'SweetinWidget',
  displayName: 'Sweetin',
  deploymentTarget: '17.0',
  // DA « net + éclats » : fond de l'écran (blanc, nuit en sombre), framboise et citron en éclats
  colors: {
    $widgetBackground: { color: '#FFFFFF', darkColor: '#0E0B0C' },
    $accent: '#FF2E5B',
    paper: { color: '#FFFFFF', darkColor: '#0E0B0C' }, // le fond
    ink: { color: '#160F12', darkColor: '#FFFFFF' }, // le texte et le bouton
    cerise: '#FF2E5B', // framboise : la glace
    cacao: '#160F12', // nuit fixe : texte sur citron, cornet sur photo
    vanille: '#FFFFFF',
    sucre: '#FFE6EB',
    citron: '#E8FF5A', // le compteur
  },
  // la glace est dessinée en SwiftUI (BrandShapes.swift) ; le sucre givré est une tuile qui se répète
  images: { sucre: require('path').join(__dirname, '../../assets/sucre-givre.png') },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
