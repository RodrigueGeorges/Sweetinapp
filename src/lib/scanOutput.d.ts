import type { CameraOutput } from 'react-native-vision-camera';

/** Implémentations par plateforme : scanOutput.ios.ts (ObjectOutput) et scanOutput.android.ts (ML Kit). */
export declare function useScanOutput(onValue: (value: string) => void): CameraOutput;
