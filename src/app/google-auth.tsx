import { Redirect } from 'expo-router';

/**
 * Adresse de retour de la connexion Google (sweetin://google-auth).
 * La session est déjà échangée par signInWithGoogle() ; si l'app a été rouverte par ce lien, on repart de l'aiguillage.
 */
export default function GoogleAuth() {
  return <Redirect href="/" />;
}
