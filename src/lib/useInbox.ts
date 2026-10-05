import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useState } from 'react';
import { listInbox, type InboxItem } from './api';
import { supabase } from './supabase';
import { useSession } from './session';
import { updateWidget } from './widget';

/** Boîte de réception tenue à jour en temps réel (nouveaux flips reçus). */
export function useInbox() {
  const { session } = useSession();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  // un nom de canal par instance : la barre d'onglets et l'écran Boîte écoutent en même temps,
  // et supabase renvoie le canal existant (déjà abonné) si deux instances partagent le même nom
  const tag = useId();

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const list = await listInbox();
      setItems(list);
      updateWidget(list);
      // pastille sur l'icône de l'app = nombre de secrets à gratter
      Notifications.setBadgeCountAsync(list.length).catch(() => {});
    } catch {
      // hors ligne : on garde la liste actuelle
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    const channel = supabase
      .channel(`inbox-${uid}-${tag}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flip_recipients', filter: `recipient_id=eq.${uid}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id, refresh, tag]);

  return { items, loading, refresh };
}
