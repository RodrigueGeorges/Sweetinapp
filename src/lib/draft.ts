import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Mode } from './api';

const KEY = 'sweetin.guestDraft';

/** Flip en cours de création, partagé entre les écrans Caméra → Carte → Send to. */
export const draft = {
  uri: '' as string,
  message: '',
  mode: 'free' as Mode,
  replyTo: null as string | null, // id du profil à présélectionner
  replyName: null as string | null, // son pseudo, affiché sur la caméra
  /** Série en danger : message pré-rempli, on saute l'écran de rédaction. */
  quick: false as boolean,
  /** Premier secret écrit avant d'avoir un compte : il est prêt à partir. */
  get pending() {
    return !!this.uri && !!this.message;
  },
  reset() {
    this.uri = '';
    this.message = '';
    this.mode = 'free';
    this.replyTo = null;
    this.replyName = null;
    this.quick = false;
    AsyncStorage.removeItem(KEY).catch(() => {});
  },
  /** Garde le secret de côté pendant l'inscription (l'email de confirmation fait quitter l'app). */
  save() {
    return AsyncStorage.setItem(KEY, JSON.stringify({ uri: this.uri, message: this.message, mode: this.mode })).catch(() => {});
  },
  async restore() {
    if (this.pending) return true;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw) as { uri: string; message: string; mode: Mode };
      Object.assign(this, { uri: d.uri, message: d.message, mode: d.mode });
      return this.pending;
    } catch {
      return false;
    }
  },
};
