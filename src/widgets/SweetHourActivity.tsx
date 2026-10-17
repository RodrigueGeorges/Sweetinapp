// Android et web : pas de Live Activity (iOS seulement, voir SweetHourActivity.ios.tsx).
// Le Sweet Hour y passe par la notification du canal « sweethour » et le compte à rebours dans l'app.
export type SweetHourProps = { endsAt: number; title: string; sub: string };

export const SweetHourActivity = {
  getInstances: (): unknown[] => [],
  start: (_props: SweetHourProps, _url?: string, _staleDate?: Date): void => {},
};
