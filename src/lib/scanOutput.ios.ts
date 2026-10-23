import { isScannedCode, useObjectOutput, type CameraOutput, type ScannedObject } from 'react-native-vision-camera';

/**
 * Sortie caméra « QR d'ami » : sur iOS, VisionCamera détecte les codes natifs (ObjectOutput).
 * Même signature que la version Android, qui passe par ML Kit (scanOutput.android.ts).
 */
export function useScanOutput(onValue: (value: string) => void): CameraOutput {
  return useObjectOutput({
    types: ['qr'],
    onObjectsScanned: (objects: ScannedObject[]) => {
      const code = objects.find(isScannedCode)?.value;
      if (code) onValue(code);
    },
  });
}
