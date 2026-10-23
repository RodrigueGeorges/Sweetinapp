import type { CameraOutput } from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';

/**
 * Sortie caméra « QR d'ami » : ObjectOutput n'existe pas sur Android — on passe par le
 * greffon ML Kit (même résultat : une CameraOutput branchée sur <Camera outputs={…}>).
 */
export function useScanOutput(onValue: (value: string) => void): CameraOutput {
  return useBarcodeScannerOutput({
    barcodeFormats: ['qr-code'],
    onBarcodeScanned: (barcodes) => {
      for (const b of barcodes) {
        if (b.rawValue) {
          onValue(b.rawValue);
          return;
        }
      }
    },
    onError: () => {},
  });
}
