/** Widget iOS « Sweetin » (WidgetKit). Les données viennent de l'app via le groupe d'apps partagé. */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'SweetinWidget',
  displayName: 'Sweetin',
  deploymentTarget: '17.0',
  colors: {
    $widgetBackground: '#FF2D5F',
    $accent: '#FF2D5F',
    cerise: '#FF2D5F',
    ceriseTop: '#FF4473',
    ceriseBottom: '#EB1650',
    cacao: '#1A0A0E',
    vanille: '#FFF4E6',
    pistache: '#C5EE6A',
  },
  // le logo qui fond (vanille), utilisé par Image("logo")
  images: { logo: require('path').join(__dirname, '../../assets/widget-logo.png') },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
