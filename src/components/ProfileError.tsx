import { Fondue } from './Fondue';
import { Button, Empty, Screen } from './ui';
import { t } from '../i18n';

/** Le profil existe mais sa lecture a échoué : on propose de réessayer plutôt que de renvoyer vers la création de profil. */
export function ProfileError({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen>
      <Empty art={<Fondue mood="sad" size={130} />} title={t('common.loadFailed')} action={<Button label={t('common.retry')} icon="retake" size="md" onPress={onRetry} />} />
    </Screen>
  );
}
