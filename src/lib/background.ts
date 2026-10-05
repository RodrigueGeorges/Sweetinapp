import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { listInbox } from './api';
import { updateWidget } from './widget';

export const WIDGET_SYNC_TASK = 'sweetin.widgetSync';

/**
 * Tâche de fond : quand un push « flip » arrive app fermée, on recharge la boîte
 * et on met à jour le widget d'accueil + le badge (le mécanisme « passive presence »).
 * iOS : déclenchée par `contentAvailable: true` dans le push (voir _shared/util.ts).
 * Android : par le message silencieux de données envoyé avec la notification.
 * Définie au niveau module : expo-task-manager recharge le bundle JS en arrière-plan.
 */
TaskManager.defineTask<Notifications.NotificationTaskPayload>(WIDGET_SYNC_TASK, async ({ data, error }) => {
  if (error) return Notifications.BackgroundNotificationTaskResult.Failed;
  // Android : la tâche tourne aussi au tap d'une notification — inutile, l'app s'ouvre
  if ('actionIdentifier' in data) return Notifications.BackgroundNotificationTaskResult.NoData;
  try {
    const items = await listInbox();
    await updateWidget(items);
    await Notifications.setBadgeCountAsync(items.length).catch(() => {});
    return Notifications.BackgroundNotificationTaskResult.NewData;
  } catch {
    return Notifications.BackgroundNotificationTaskResult.Failed;
  }
});

/** Branche la tâche côté natif (sans effet dans Expo Go / web). */
export function registerWidgetSync() {
  try {
    if (TaskManager.isTaskDefined(WIDGET_SYNC_TASK)) {
      Notifications.registerTaskAsync(WIDGET_SYNC_TASK).catch(() => {});
    }
  } catch {
    // module natif indisponible : rien à faire
  }
}
