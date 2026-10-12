// plugins/withImeService.js
const { withAndroidManifest, withDangerousMod, withStringsXml, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin that:
 * 1. Copies custom Kotlin source files and resources into android/ app directory during prebuild.
 * 2. Registers QyKeyInputMethodService as an Android IME.
 * 3. Sets QyKeyApplication as the Application class and adds VIBRATE permission.
 * 4. Fixes any Groovy build.gradle syntax issues.
 */
function withNativeSourceCopy(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const nativeFilesDir = path.join(projectRoot, 'native');

      // 1. Copy Kotlin files
      const srcJavaDir = path.join(nativeFilesDir, 'java', 'com', 'qykey');
      const targetJavaDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'qykey'
      );

      if (fs.existsSync(srcJavaDir)) {
        fs.mkdirSync(targetJavaDir, { recursive: true });
        const files = fs.readdirSync(srcJavaDir);
        for (const file of files) {
          fs.copyFileSync(
            path.join(srcJavaDir, file),
            path.join(targetJavaDir, file)
          );
        }
        console.log(`[withImeService] Copied ${files.length} Kotlin files to ${targetJavaDir}`);
      }

      // 2. Copy method.xml
      const srcXmlFile = path.join(nativeFilesDir, 'res', 'xml', 'method.xml');
      const targetXmlDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'xml'
      );

      if (fs.existsSync(srcXmlFile)) {
        fs.mkdirSync(targetXmlDir, { recursive: true });
        fs.copyFileSync(srcXmlFile, path.join(targetXmlDir, 'method.xml'));
        console.log('[withImeService] Copied method.xml');
      }

      // 3. Copy dictionary binary files
      const srcDictDir = path.join(projectRoot, 'assets', 'dictionaries');
      const targetDictDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'assets',
        'dictionaries'
      );

      if (fs.existsSync(srcDictDir)) {
        fs.mkdirSync(targetDictDir, { recursive: true });
        for (const file of ['english.bin', 'bangla.bin']) {
          const srcBin = path.join(srcDictDir, file);
          if (fs.existsSync(srcBin)) {
            fs.copyFileSync(srcBin, path.join(targetDictDir, file));
            console.log(`[withImeService] Copied ${file} to assets/dictionaries`);
          }
        }
      }

      // 3b. Copy bundled emoji font into assets/fonts. ReactFontManager
      // auto-loads fonts/<FamilyName>.ttf for unregistered families, so JS
      // fontFamily: 'NotoColorEmoji' resolves to the bundled NotoColorEmoji
      // without any Kotlin registration — and old devices (Android 11 and
      // below) get full-color emoji that the system font lacks.
      const srcFontsDir = path.join(projectRoot, 'assets', 'fonts');
      const targetFontsDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'assets',
        'fonts'
      );

      if (fs.existsSync(srcFontsDir)) {
        fs.mkdirSync(targetFontsDir, { recursive: true });
        const fontFiles = fs
          .readdirSync(srcFontsDir)
          .filter((f) => /\.(ttf|otf)$/i.test(f));
        for (const file of fontFiles) {
          fs.copyFileSync(
            path.join(srcFontsDir, file),
            path.join(targetFontsDir, file)
          );
          console.log(`[withImeService] Copied ${file} to assets/fonts`);
        }
      }

      // 3c. Copy cursor SVG assets into assets/svg so the IME-process cursor
      // overlay can render the user's chosen cursor type natively.
      const srcSvgDir = path.join(projectRoot, 'assets', 'svg');
      const targetSvgDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'assets',
        'svg'
      );

      if (fs.existsSync(srcSvgDir)) {
        fs.mkdirSync(targetSvgDir, { recursive: true });
        const svgFiles = fs
          .readdirSync(srcSvgDir)
          .filter((f) => /\.svg$/i.test(f));
        for (const file of svgFiles) {
          fs.copyFileSync(
            path.join(srcSvgDir, file),
            path.join(targetSvgDir, file)
          );
        }
        console.log(`[withImeService] Copied ${svgFiles.length} cursor SVGs to assets/svg`);
      }

      // 4. Copy ProGuard rules file to prevent R8 stripping custom classes
      const srcProGuard = path.join(nativeFilesDir, 'proguard-rules.pro');
      const targetProGuard = path.join(
        projectRoot,
        'android',
        'app',
        'proguard-rules.pro'
      );
      if (fs.existsSync(srcProGuard)) {
        fs.mkdirSync(path.dirname(targetProGuard), { recursive: true });
        fs.copyFileSync(srcProGuard, targetProGuard);
        console.log('[withImeService] Copied proguard-rules.pro');
      }

      // 5. Fix build.gradle — tasks.withType syntax + proguard integration
      const buildGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
      if (fs.existsSync(buildGradlePath)) {
        let content = fs.readFileSync(buildGradlePath, 'utf8');

        // Fix tasks.withType<Test> → tasks.withType(Test) for Groovy compatibility
        if (content.includes('tasks.withType<Test>')) {
          content = content.replace('tasks.withType<Test>', 'tasks.withType(Test)');
          console.log('[withImeService] Fixed tasks.withType in android/app/build.gradle');
        }

        // Ensure proguard-rules.pro is referenced in the release build type
        // so the R8 keep rules are actually applied during minification
        const proguardRefExists = content.includes("'proguard-rules.pro'") || content.includes('"proguard-rules.pro"');
        if (!proguardRefExists) {
          // Add proguard-rules.pro to the proguardFiles line in the release block
          content = content.replace(
            /(proguardFiles\s+getDefaultProguardFile\([^)]+\))/g,
            "$1, 'proguard-rules.pro'"
          );
          fs.writeFileSync(buildGradlePath, content, 'utf8');
          console.log('[withImeService] Added proguard-rules.pro reference in build.gradle');
        }

        // Ensure the androidsvg dependency is present — the IME-process cursor
        // overlay parses the user's chosen cursor SVG with it (PointerOverlay.kt).
        if (!content.includes('com.caverock:androidsvg')) {
          content = content.replace(
            /(dependencies\s*\{)/,
            '$1\n    // QyKey: SVG parsing for the touchpad cursor overlay (PointerOverlay.kt)\n    implementation("com.caverock:androidsvg:1.4")'
          );
          fs.writeFileSync(buildGradlePath, content, 'utf8');
          console.log('[withImeService] Added androidsvg dependency to build.gradle');
        }
      }

      return config;
    },
  ]);
}

module.exports = function withImeService(config) {
  // First apply native source copy
  config = withNativeSourceCopy(config);

  // Apply strings.xml updates for ime_name
  config = withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [
        {
          $: { name: 'ime_name' },
          _: 'QyKey Keyboard',
        },
      ],
      config.modResults
    );
    return config;
  });

  // Then apply manifest updates
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (!application) {
      throw new Error('withImeService: Could not find <application> in AndroidManifest.xml');
    }

    // 1. Set custom Application class
    application.$['android:name'] = '.QyKeyApplication';

    // 2. Add IME service declaration
    if (!application.service) {
      application.service = [];
    }

    // Check if service already registered (avoid duplicates on repeated prebuild)
    const alreadyRegistered = application.service.some(
      (s) => s.$?.['android:name'] === '.QyKeyInputMethodService'
    );

    if (!alreadyRegistered) {
      application.service.push({
        $: {
          'android:name': '.QyKeyInputMethodService',
          'android:label': '@string/ime_name',
          'android:permission': 'android.permission.BIND_INPUT_METHOD',
          'android:exported': 'true',
          'android:process': ':ime_process', // separate process
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.view.InputMethod' },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.view.im',
              'android:resource': '@xml/method',
            },
          },
        ],
      });
    }

    // 3. Add VIBRATE permission
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const hasVibrate = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.VIBRATE'
    );

    if (!hasVibrate) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.VIBRATE' },
      });
    }

    return config;
  });
};
