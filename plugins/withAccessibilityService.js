// plugins/withAccessibilityService.js
const { withAndroidManifest, withDangerousMod, withStringsXml, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin that:
 * 1. Copies res/xml/accessibility_service_config.xml into android/ during prebuild.
 * 2. Adds the @string/a11y_service_name label.
 * 3. Registers QyKeyAccessibilityService in the manifest (same :ime_process as the IME).
 *
 * NOTE: QyKeyAccessibilityService.kt is copied by withImeService.js (it copies the   * whole native/java/com/qykey/ directory), so this plugin only handles the
 * XML resource + manifest entry. Keep it listed AFTER withImeService in app.json.
 */
function withAccessibilityXmlCopy(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const srcXml = path.join(
        projectRoot, 'native', 'res', 'xml', 'accessibility_service_config.xml'
      );
      const targetDir = path.join(
        projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml'
      );
      if (fs.existsSync(srcXml)) {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(srcXml, path.join(targetDir, 'accessibility_service_config.xml'));
        console.log('[withAccessibilityService] Copied accessibility_service_config.xml');
      } else {
        console.warn('[withAccessibilityService] accessibility_service_config.xml not found — skipped');
      }
      return config;
    },
  ]);
}

module.exports = function withAccessibilityService(config) {
  config = withAccessibilityXmlCopy(config);

  config = withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'a11y_service_name' }, _: 'QyKey Accessibility' }],
      config.modResults
    );
    return config;
  });

  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) {
      throw new Error('withAccessibilityService: Could not find <application> in AndroidManifest.xml');
    }
    if (!application.service) application.service = [];

    // Avoid duplicates on repeated prebuild
    const alreadyRegistered = application.service.some(
      (s) => s.$?.['android:name'] === '.QyKeyAccessibilityService'
    );

    if (!alreadyRegistered) {
      application.service.push({
        $: {
          'android:name': '.QyKeyAccessibilityService',
          'android:label': '@string/a11y_service_name',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'true',
          'android:process': ':ime_process', // same process as IME + keyboard host
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.accessibilityservice',
              'android:resource': '@xml/accessibility_service_config',
            },
          },
        ],
      });
      console.log('[withAccessibilityService] Registered QyKeyAccessibilityService');
    }

    return config;
  });
};
