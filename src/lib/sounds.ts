import { kv } from './kv';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Identité sonore Sweetin (fichiers générés par scripts/generate_sounds.py).
 * Motif signature : trois notes de verre qui montent, « swee-ti-n ».
 * Les sons respectent le mode silencieux du téléphone et se coupent dans Réglages.
 */
const SOURCES = {
  sweet: require('../../assets/sounds/sweet.wav'), // flip reçu
  scratch: require('../../assets/sounds/scratch.wav'), // sous le doigt, en boucle
  reveal: require('../../assets/sounds/reveal.wav'), // le message apparaît
  sent: require('../../assets/sounds/sent.wav'), // flip envoyé
  sweethour: require('../../assets/sounds/sweethour.wav'), // le Sweet Hour commence
  streak: require('../../assets/sounds/streak.wav'), // la série grimpe
  tap: require('../../assets/sounds/tap.wav'), // la photo se retourne
  melt: require('../../assets/sounds/melt.wav'), // le secret fond
} as const;

export type SoundName = keyof typeof SOURCES;

const KEY = 'sweetin.sounds';
const players = new Map<SoundName, AudioPlayer>();
let enabled = true;
let ready = false;

function player(name: SoundName) {
  let p = players.get(name);
  if (!p) {
    p = createAudioPlayer(SOURCES[name]);
    players.set(name, p);
  }
  return p;
}

/** À appeler une fois au démarrage. */
export async function initSounds() {
  if (ready) return;
  ready = true;
  try {
    enabled = (await kv.getItem(KEY)) !== 'off';
    // jamais de son en mode silencieux, et on se mélange à la musique en cours au lieu de la couper
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  } catch {}
}

export const soundsEnabled = () => enabled;

export async function setSoundsEnabled(on: boolean) {
  enabled = on;
  if (!on) scratchLoop.stop();
  await kv.setItem(KEY, on ? 'on' : 'off').catch(() => {});
}

export function play(name: SoundName, volume = 1) {
  if (!enabled) return;
  try {
    const p = player(name);
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {}
}

/** Le grain de la feuille qu'on gratte : démarre au premier contact, s'arrête quand le doigt se lève. */
export const scratchLoop = {
  start(volume = 0.55) {
    if (!enabled) return;
    try {
      const p = player('scratch');
      p.loop = true;
      p.volume = volume;
      p.play();
    } catch {}
  },
  stop() {
    try {
      const p = players.get('scratch');
      if (p) {
        p.pause();
        p.seekTo(0).catch(() => {});
      }
    } catch {}
  },
};
