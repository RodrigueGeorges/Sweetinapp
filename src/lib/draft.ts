import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Mode, WordStyle } from './api';

const KEY = 'sweetin.guestDraft';

/** Flip en cours de création, partagé entre les écrans Caméra → Carte → Send to. */
export const draft = {
  uri: '' as string,
  message: '',
  mode: 'free' as Mode,
  replyTo: null as string | null, // id du profil à présélectionner
  replyName: null as string | null, // son pseudo, affiché sur la caméra
  /** Placement du mot sur le verso (déplacé/pincé comme sur Insta) — reproduit à l'identique chez le destinataire. */
  wordStyle: null as WordStyle | null,
  /** « plus tard » : le secret est gardé mais on n'y est plus renvoyé à chaque ouverture — l'inbox propose de le reprendre. */
  deferred: false,
  /** La photo vient d'être prise (ou choisie) : la carte s'ouvre en se réduisant depuis le plein écran. */
  fromCamera: false,
  /** Photo prête : le secret n'a pas encore été écrit. */
  setPhoto(uri: string) {
    this.uri = uri;
    this.message = '';
    this.wordStyle = null;
    this.deferred = false;
  },
  /** Photo fraîchement prise à la caméra : `fromCamera` vrai jusqu'à ce que la carte le consomme. */
  setCameraPhoto(uri: string) {
    this.setPhoto(uri);
    this.fromCamera = true;
  },
  /** Secret validé au dos de la carte. */
  setMessage(message: string, once: boolean) {
    this.message = message;
    this.mode = once ? 'once' : 'free';
  },
  /** Style du mot choisi sur le verso (null = centré automatiquement). */
  setWordStyle(style: WordStyle | null) {
    this.wordStyle = style;
  },
  /** Réponse à un ami : son profil est présélectionné dans « envoyer à ». */
  setReply(id: string | null, name: string | null) {
    this.replyTo = id;
    this.replyName = name;
  },
  /** Lit puis remet `fromCamera` à faux (consommé une seule fois, à l'ouverture de la carte). */
  takeFromCamera() {
    const v = this.fromCamera;
    this.fromCamera = false;
    return v;
  },
  /** Premier secret écrit avant d'avoir un compte : il est prêt à partir. */
  get pending() {
    return !!this.uri && !!this.message;
  },
  /** Secret prêt mais l'envoi n'est pas forcé : seul un brouillon non remis renvoie vers « envoyer à ». */
  get mustSend() {
    return this.pending && !this.deferred;
  },
  /** L'utilisateur passe l'envoi pour l'instant : le brouillon reste récupérable depuis l'inbox. */
  defer() {
    this.deferred = true;
  },
  reset() {
    this.uri = '';
    this.message = '';
    this.mode = 'free';
    this.deferred = false;
    this.uri = '';
    this.message = '';
    this.mode = 'free';
    this.replyTo = null;
    this.replyName = null;
    this.fromCamera = false;
    this.wordStyle = null;
    AsyncStorage.removeItem(KEY).catch(() => {});
  },
  /** Garde le secret de côté pendant l'inscription (l'email de confirmation fait quitter l'app). */
  save() {
    return AsyncStorage.setItem(KEY, JSON.stringify({ uri: this.uri, message: this.message, mode: this.mode, wordStyle: this.wordStyle, deferred: this.deferred })).catch(() => {});
  },
  async restore() {
    if (this.pending) return true;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw) as { uri: string; message: string; mode: Mode; wordStyle?: WordStyle | null; deferred?: boolean };
      Object.assign(this, { uri: d.uri, message: d.message, mode: d.mode, wordStyle: d.wordStyle ?? null, deferred: d.deferred ?? false });
      return this.pending;
    } catch {
      return false;
    }
  },
};
