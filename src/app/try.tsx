import { useEffect } from 'react';
import { CameraScreen } from '../components/CameraScreen';
import { track } from '../lib/monitoring';

/** Premier secret sans compte : on prend la photo, on écrit, et le compte n'est demandé qu'à l'envoi. */
export default function Try() {
  useEffect(() => track('guest_started'), []);
  return <CameraScreen guest />;
}
