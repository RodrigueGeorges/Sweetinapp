import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, font, foregroundStyle, monospacedDigit, multilineTextAlignment, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

/**
 * Sweet Hour sur l'écran verrouillé et dans la Dynamic Island (iOS 16.1+) :
 * un compte à rebours de 2 minutes, tout le monde poste en même temps.
 * Démarrée à distance par le serveur (push-to-start, iOS 17.2+), ou par l'app si elle est ouverte.
 * Ce composant tourne dans l'extension iOS : pas de hooks, tout arrive par les props (textes déjà traduits).
 */
export type SweetHourProps = {
  /** Fin du Sweet Hour, en millisecondes depuis 1970. */
  endsAt: number;
  title: string;
  sub: string;
  /** Libellé du bouton qui ouvre la caméra (Dynamic Island dépliée). */
  cta: string;
};

const SweetHour = (props: SweetHourProps, env: LiveActivityEnvironment) => {
  'widget';
  // couleurs de la DA (le composant ne voit rien hors de lui-même)
  const CERISE = '#FF2D5F';
  const VANILLE = '#FFF4E6';
  const CACAO = '#1A0A0E';
  const PISTACHE = '#C6F36B';
  const end = new Date(props.endsAt);
  const range = { lower: new Date(Math.min(Date.now(), props.endsAt)), upper: end };
  const dim = env.isLuminanceReduced === true;
  const timer = (size: number, color: string) => (
    <Text timerInterval={range} countsDown modifiers={[font({ size, weight: 'black', design: 'rounded' }), monospacedDigit(), foregroundStyle(color), multilineTextAlignment('trailing')]} />
  );
  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 16 }), activityBackgroundTint(dim ? CACAO : CERISE)]}>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 22, weight: 'black' }), foregroundStyle(VANILLE)]}>{props.title}</Text>
          <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(dim ? VANILLE : CACAO)]}>{props.sub}</Text>
        </VStack>
        <Spacer />
        {timer(40, dim ? PISTACHE : VANILLE)}
      </HStack>
    ),
    compactLeading: <Image systemName="sparkles" color={PISTACHE} />,
    compactTrailing: timer(15, PISTACHE),
    minimal: <Image systemName="sparkles" color={PISTACHE} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 18, weight: 'black' }), foregroundStyle(PISTACHE)]}>{props.title}</Text>
      </VStack>
    ),
    expandedTrailing: timer(28, VANILLE),
    expandedBottom: (
      <HStack spacing={12}>
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(VANILLE)]}>{props.sub}</Text>
        <Spacer />
        {/* iOS 26 : lien natif vers la caméra, un tap depuis la Dynamic Island dépliée */}
        <Link destination="sweetin://camera" modifiers={[font({ size: 14, weight: 'black' }), foregroundStyle(PISTACHE)]}>
          <Text>{props.cta}</Text>
        </Link>
      </HStack>
    ),
  };
};

export const SweetHourActivity = createLiveActivity<SweetHourProps>('SweetHour', SweetHour);
