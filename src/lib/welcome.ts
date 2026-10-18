import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { t } from '../i18n';
import type { InboxItem, OpenedFlip } from './api';

/**
 * Le sweet de bienvenue : tant qu'on n'a rien reçu, la vitrine montre un sweet « de sweetin » à gratter tout de suite.
 * Rien ne passe par le serveur : photo embarquée dans l'app, mot traduit, lecture notée sur le téléphone.
 */
export const WELCOME_ID = 'bienvenue';
const KEY = 'sweetin.welcome.read';
const PHOTO = require('../../assets/welcome.jpg');
export const WELCOME_PHOTO = PHOTO;

export const isWelcome = (id?: string | null) => id === WELCOME_ID;

export const welcomeItem = (): InboxItem =>
  ({ flip_id: WELCOME_ID, created_at: new Date().toISOString(), mode: 'free', sender: { id: 'sweetin', username: 'sweetin', avatar_url: null }, opened: false, preview: null }) as unknown as InboxItem;

export const welcomeFlip = (): OpenedFlip => ({
  id: WELCOME_ID,
  sender_id: '',
  sender: 'sweetin',
  sender_avatar: null,
  mode: 'free',
  created_at: new Date().toISOString(),
  photo_url: '',
  message: t('welcome.sweetMsg'),
});

/** La photo du sweet de bienvenue, décodée en mémoire comme une vraie photo reçue. */
export async function loadWelcomePhoto(): Promise<SkImage> {
  const a = Asset.fromModule(PHOTO);
  await a.downloadAsync();
  const data = await Skia.Data.fromURI(a.localUri ?? a.uri);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) throw new Error('photo');
  return img;
}

export const markWelcomeRead = () => AsyncStorage.setItem(KEY, '1').catch(() => {});

/** Vrai tant que le sweet de bienvenue n'a pas été lu (relu à chaque retour sur la vitrine). */
export function useWelcome(): boolean {
  const [show, setShow] = useState(false);
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(KEY)
        .then((v) => setShow(!v))
        .catch(() => setShow(false));
    }, []),
  );
  return show;
}
