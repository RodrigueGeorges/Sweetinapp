/**
 * Le splash de lancement est affiché par-dessus la pile : tant qu'il est visible,
 * les écrans dessous ne doivent pas toucher la barre d'état (elle reste claire
 * sur la framboise). Remis à faux quand le rideau a fini de sortir.
 */
export let splashVisible = true;

export function endSplashState() {
  splashVisible = false;
}
