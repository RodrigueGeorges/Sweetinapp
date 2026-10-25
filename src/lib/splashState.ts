import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';

/**
 * Le splash de lancement est affiché par-dessus la pile : tant qu'il est visible,
 * les écrans dessous ne doivent pas toucher la barre d'état (elle reste claire
 * sur la framboise). Remis à faux quand le rideau a fini de sortir.
 */
export let splashVisible = true;
// le style demandé par l'écran du dessous pendant le splash : appliqué à la sortie du rideau
let pending: StatusBarStyle | null = null;

export function requestStatusBar(style: StatusBarStyle) {
  if (splashVisible) pending = style;
  else setStatusBarStyle(style, true);
}

export function endSplashState() {
  splashVisible = false;
  if (pending) setStatusBarStyle(pending, true);
  pending = null;
}
