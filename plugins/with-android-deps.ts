import { withAppBuildGradle, type ConfigPlugin } from 'expo/config-plugins';

/**
 * androidx.work : une dépendance tire work-runtime-ktx:2.7.1 alors que work-runtime:2.8.1
 * est déjà là → « Duplicate class androidx.work.* » à checkDebugDuplicateClasses.
 * Depuis 2.8, work-runtime-ktx est un shim vide (classes dans work-runtime) : forcer les
 * deux en 2.8.1 supprime le doublon sans changer le runtime.
 */
const withAndroidDeps: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (c) => {
    if (c.modResults.language === 'groovy' && !c.modResults.contents.includes('androidx.work:work-runtime')) {
      c.modResults.contents += `
configurations.all {
    resolutionStrategy {
        force 'androidx.work:work-runtime:2.8.1'
        force 'androidx.work:work-runtime-ktx:2.8.1'
    }
}
`;
    }
    return c;
  });

export default withAndroidDeps;
