/**
 * Expo config plugin — two jobs:
 *
 * 1. Force newArchEnabled=false in gradle.properties
 *    (react-native-worklets-core and @supersami/rn-foreground-service are
 *    not New Architecture compatible with RN 0.83.x)
 *
 * 2. Add Android manifest entries required by @supersami/rn-foreground-service:
 *    • FOREGROUND_SERVICE + FOREGROUND_SERVICE_DATA_SYNC permissions
 *    • POST_NOTIFICATIONS permission (Android 13+)
 *    • ForegroundService + ForegroundServiceTask <service> declarations
 */
const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

// ─── gradle.properties patch ──────────────────────────────────────────────────

const withOldArch = (config) =>
  withGradleProperties(config, (mod) => {
    const props = mod.modResults;

    // Find and overwrite any existing newArchEnabled entry
    const idx = props.findIndex(
      (p) => p.type === 'property' && p.key === 'newArchEnabled'
    );
    if (idx !== -1) {
      props[idx].value = 'false';
    } else {
      props.push({ type: 'property', key: 'newArchEnabled', value: 'false' });
    }

    return mod;
  });

// ─── AndroidManifest.xml patch ────────────────────────────────────────────────

function addPermission(manifest, name) {
  const permissions = manifest['uses-permission'] || [];
  const already = permissions.some((p) => p.$?.['android:name'] === name);
  if (!already) {
    permissions.push({ $: { 'android:name': name } });
  }
  manifest['uses-permission'] = permissions;
}

function addService(application, name, foregroundServiceType) {
  const services = application.service || [];
  const already = services.some((s) => s.$?.['android:name'] === name);
  if (!already) {
    services.push({
      $: {
        'android:name': name,
        'android:foregroundServiceType': foregroundServiceType,
        'android:exported': 'false',
      },
    });
  }
  application.service = services;
}

const withForegroundServiceManifest = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    addPermission(manifest, 'android.permission.FOREGROUND_SERVICE');
    addPermission(manifest, 'android.permission.FOREGROUND_SERVICE_DATA_SYNC');
    addPermission(manifest, 'android.permission.POST_NOTIFICATIONS');

    const application = manifest.application?.[0];
    if (application) {
      addService(application, 'com.supersami.foreground.ForegroundService',     'dataSync');
      addService(application, 'com.supersami.foreground.ForegroundServiceTask', 'dataSync');
    }

    return mod;
  });

// ─── Compose both modifiers ───────────────────────────────────────────────────

const withForegroundService = (config) =>
  withForegroundServiceManifest(withOldArch(config));

module.exports = withForegroundService;
