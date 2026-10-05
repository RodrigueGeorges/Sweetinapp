import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect } from 'react';
import { useToast } from '../../components/Toast';
import { t } from '../../i18n';
import { consumePendingInvite, useSession } from '../../lib/session';
import { useInbox } from '../../lib/useInbox';
import { useTheme } from '../../theme';

/**
 * Barre d'onglets native (UITabBar en verre sur iOS 26, barre Material 3 sur Android) :
 * boîte · appareil photo · amis. Icônes système (SF Symbols / Material Symbols), badge natif.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { session, profile } = useSession();
  const { items } = useInbox();
  const toast = useToast();
  // invitation ouverte avant la connexion : on ajoute l'ami maintenant
  useEffect(() => {
    if (profile?.onboarded) consumePendingInvite().then((name) => name && toast(t('invite.added', { name })));
  }, [profile?.onboarded, toast]);
  if (!session) return <Redirect href="/welcome" />;
  if (!profile?.onboarded) return <Redirect href="/profile-setup" />;
  return (
    <NativeTabs
      tintColor={colors.cerise}
      iconColor={{ default: colors.muted, selected: colors.cerise }}
      labelStyle={{ default: { color: colors.muted, fontSize: 11, fontWeight: '600' }, selected: { color: colors.cerise, fontSize: 11, fontWeight: '700' } }}
      badgeBackgroundColor={colors.cerise}
      indicatorColor={colors.riskBg}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="inbox" accessibilityLabel={t('tabs.inbox', { n: items.length })}>
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
        <NativeTabs.Trigger.Label>{t('tabs.inboxShort')}</NativeTabs.Trigger.Label>
        {items.length > 0 ? <NativeTabs.Trigger.Badge>{String(items.length)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="camera">
        <NativeTabs.Trigger.Icon sf={{ default: 'camera', selected: 'camera.fill' }} md="photo_camera" />
        <NativeTabs.Trigger.Label>{t('tabs.camera')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* rôle natif « recherche » iOS : la recherche d'amis vit dans l'onglet Amis */}
      <NativeTabs.Trigger name="contacts" role="search">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        <NativeTabs.Trigger.Label>{t('tabs.contacts')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
