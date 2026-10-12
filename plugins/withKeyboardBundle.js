// plugins/withKeyboardBundle.js
const { withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Resolve the hermesc binary path from either hermes-compiler or react-native.
 * Returns the absolute path to the hermesc executable, or null if not found.
 */
function resolveHermesc(projectRoot) {
  const candidates = [];

  // Determine OS-specific binary directory
  const platform = process.platform;
  let osBin;
  if (platform === 'linux') osBin = 'linux64-bin';
  else if (platform === 'darwin') osBin = 'osx-bin';
  else if (platform === 'win32') osBin = 'win64-bin';

  // 1. Try hermes-compiler package (used in RN 0.86+)
  try {
    const hermesCompilerPkg = require.resolve('hermes-compiler/package.json', {
      paths: [projectRoot],
    });
    const hermesDir = path.dirname(hermesCompilerPkg);

    if (osBin) {
      candidates.push(path.join(hermesDir, 'hermesc', osBin, 'hermesc'));
      candidates.push(path.join(hermesDir, 'hermesc', osBin, 'hermesc.exe'));
      candidates.push(path.join(hermesDir, osBin, 'hermesc'));
      candidates.push(path.join(hermesDir, osBin, 'hermesc.exe'));
    }
    candidates.push(path.join(hermesDir, 'hermesc'));
    candidates.push(path.join(hermesDir, 'hermesc.exe'));
  } catch (e) {
    // hermes-compiler not found via require.resolve
  }

  // 2. Try react-native's bundled hermes
  try {
    const rnPkg = require.resolve('react-native/package.json', {
      paths: [projectRoot],
    });
    const rnDir = path.dirname(rnPkg);
    const sdkDir = path.join(rnDir, 'sdks', 'hermesc');

    if (osBin) {
      candidates.push(path.join(sdkDir, osBin, 'hermesc'));
      candidates.push(path.join(sdkDir, osBin, 'hermesc.exe'));
    }
  } catch (e) {
    // react-native not found
  }

  // 3. Try global / npx hermesc
  candidates.push('hermesc');

  for (const candidate of candidates) {
    try {
      if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
        return candidate;
      }
      if (!path.isAbsolute(candidate)) {
        execSync(`${candidate} --version`, { stdio: 'pipe' });
        return candidate;
      }
    } catch (e) {
      // Not found at this candidate path
    }
  }
  return null;
}

/**
 * Check if a file is Hermes bytecode by reading magic bytes.
 * Hermes bytecode starts with the magic bytes \xC6\x1F\xBC\x03.
 */
function isHermesBytecode(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const magic = Buffer.alloc(4);
    fs.readSync(fd, magic, 0, 4, 0);
    fs.closeSync(fd);
    return magic.toString('hex') === 'c61fbc03';
  } catch (e) {
    return false;
  }
}

/**
 * Expo config plugin that builds the keyboard-only JS bundle (keyboard.bundle)
 * into android/app/src/main/assets/ alongside the main companion app bundle.
 *
 * CRITICAL: When Hermes is enabled (default in RN 0.86+), the JS bundle must
 * be compiled to Hermes bytecode (HBC). Without this step, the keyboard bundle
 * silently fails to execute, resulting in a blank keyboard.
 *
 * Steps:
 *   1. Metro bundles keyboard.index.js -> keyboard.bundle.js (plain JS)
 *   2. hermesc compiles keyboard.bundle.js -> keyboard.bundle (Hermes bytecode)
 *
 * This runs during `expo prebuild` and `eas build`.
 *
 * The Gradle task injected below (withAppBuildGradle) is the reliability net:
 * even if the prebuild step is cached or the plugin is skipped on the EAS
 * worker, the keyboard bundle is (re)built inside assembleRelease itself,
 * so the APK always ships with a valid Hermes bytecode bundle — instead of
 * silently shipping a blank keyboard.
 */

// Markers used to find and remove a previously-injected snippet, so a stale
// (or broken) version never survives a re-run or cached prebuild.
const KEYBOARD_BUNDLE_GRADLE_TASK_START_MARKER =
  '// ── QyKey: keyboard bundle Gradle task (injected by plugins/withKeyboardBundle.js) ──';
const KEYBOARD_BUNDLE_GRADLE_TASK_END_MARKER =
  '// ── END QyKey: keyboard bundle Gradle task ──';
// Legacy v2 snippet ended with this line (no END comment marker).
const KEYBOARD_BUNDLE_GRADLE_TASK_LEGACY_END =
  'tasks.matching { it.name == "mergeReleaseAssets" || it.name == "mergeDebugAssets" }.configureEach {';

// Groovy snippet appended to android/app/build.gradle. Rebuilds
// keyboard.bundle (via scripts/build-keyboard-bundle.js) before assets are
// merged/packaged, and fails the build LOUDLY if it cannot be produced.
//
// v3: Asset-merge AND AGP lint tasks both read android/app/src/main/assets.
// Gradle 9 errors on implicit dependencies (two tasks sharing a directory
// without a dependency edge), which broke `eas build` with:
//   "Task ':app:generateReleaseLintVitalReportModel' uses this output of task
//    ':app:createKeyboardBundleReleaseJsAndAssets' without declaring an
//    explicit or implicit dependency."
// So the keyboard bundle task is now wired into:
//   * mergeReleaseAssets / mergeDebugAssets  (ships the bundle in the APK)
//   * every *lint* task (e.g. generateReleaseLintVitalReportModel, lintVital*)
const KEYBOARD_BUNDLE_GRADLE_TASK = `
// ── QyKey: keyboard bundle Gradle task (injected by plugins/withKeyboardBundle.js) ──
// Rebuilds keyboard.bundle (Hermes bytecode) inside the Gradle build so the
// IME always ships with a valid bundle, even when EAS reuses a cached prebuild
// that skipped the config plugin. Previously a missing bundle shipped a
// silent blank keyboard — now the build fails instead.
//
// v2: Uses the built-in Exec task type. The previous version called
// project.exec {} which was REMOVED in Gradle 9 and broke the build with
// "Could not find method exec() ... on project ':app'" on Gradle 9.3.1.
def qykeyKeyboardBundleScript = new File(projectRoot, "scripts/build-keyboard-bundle.js")
def qykeyKeyboardBundleOut  = new File(projectRoot, "android/app/src/main/assets/keyboard.bundle")
def qykeyKeyboardBundleTask = tasks.register("createKeyboardBundleReleaseJsAndAssets", Exec) {
    group = "react"
    description = "Builds keyboard.bundle (Hermes bytecode) for the QyKey IME"
    inputs.file(qykeyKeyboardBundleScript)
    inputs.file(new File(projectRoot, "keyboard.index.js"))
    inputs.dir(new File(projectRoot, "src/app/mainKeyboard"))
    // The keyboard bundle graph also pulls in the app-side hooks (useKeyboardTheme,
    // useKeyboardState), the Zustand store they read, and the shared sound manager,
    // so all of these must be inputs too — otherwise an incremental build could
    // ship a stale keyboard.bundle.
    inputs.dir(new File(projectRoot, "src/hooks"))
    inputs.dir(new File(projectRoot, "src/store"))
    inputs.dir(new File(projectRoot, "src/data"))
    // The build script also copies assets/fonts/NotoColorEmoji.ttf into
    // android/app/src/main/assets/fonts/ (see build-keyboard-bundle.js). It
    // must be an INPUT so an up-to-date check can never skip the font copy
    // on an incremental build.
    inputs.file(new File(projectRoot, "assets/fonts/NotoColorEmoji.ttf"))
    outputs.file(qykeyKeyboardBundleOut)
    workingDir projectRoot
    commandLine "node", qykeyKeyboardBundleScript.absolutePath
    doFirst {
        if (!qykeyKeyboardBundleScript.exists()) {
            throw new GradleException("[withKeyboardBundle] FATAL: scripts/build-keyboard-bundle.js not found")
        }
    }
    doLast {
        if (!qykeyKeyboardBundleOut.exists() || qykeyKeyboardBundleOut.length() < 100) {
            throw new GradleException("[withKeyboardBundle] FATAL: keyboard.bundle was not produced — the keyboard will show BLANK")
        }
        println "[withKeyboardBundle] OK keyboard.bundle size = " + (qykeyKeyboardBundleOut.length() / 1024) + " KB"
    }
}
// Merge tasks ship the bundle in the APK; lint tasks read src/main/assets, so
// they must run AFTER the bundle task (explicit dependency, see comment above).
tasks.matching {
    it.name == "mergeReleaseAssets" || it.name == "mergeDebugAssets" || it.name.toLowerCase().contains("lint")
}.configureEach {
    dependsOn qykeyKeyboardBundleTask
}
// ── END QyKey: keyboard bundle Gradle task ──
`;

/**
 * Appends the current Gradle snippet to android/app/build.gradle contents,
 * first removing any previously-injected (possibly stale or broken) snippet.
 * Idempotent — safe to run on every prebuild.
 */
function injectKeyboardBundleGradleTask(contents) {
  const startIdx = contents.indexOf(KEYBOARD_BUNDLE_GRADLE_TASK_START_MARKER);
  if (startIdx !== -1) {
    // Remove from the start marker through the end marker, both inclusive.
    let endIdx = contents.indexOf(KEYBOARD_BUNDLE_GRADLE_TASK_END_MARKER, startIdx);
    if (endIdx !== -1) {
      endIdx += KEYBOARD_BUNDLE_GRADLE_TASK_END_MARKER.length;
    } else {
      // Legacy v2 snippet has no END comment marker — fall back to its final
      // `tasks.matching {...}.configureEach {` line and consume through the
      // first "\n}\n" (the configureEach block's closing brace) after it.
      const legacyEndIdx = contents.indexOf(KEYBOARD_BUNDLE_GRADLE_TASK_LEGACY_END, startIdx);
      if (legacyEndIdx !== -1) {
        const blockEnd = contents.indexOf('\n}\n', legacyEndIdx);
        endIdx = blockEnd !== -1 ? blockEnd + 3 : contents.length;
      } else {
        endIdx = contents.length;
      }
    }
    contents = contents.slice(0, startIdx) + contents.slice(endIdx);
  }
  // Trim trailing whitespace so repeated injections don't accumulate blank lines.
  return contents.replace(/\s+$/, '') + '\n' + KEYBOARD_BUNDLE_GRADLE_TASK;
}

const withKeyboardBundle = function withKeyboardBundle(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const assetsDir = path.join(
        projectRoot,
        'android', 'app', 'src', 'main', 'assets'
      );

      // Ensure assets directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const entryFile = path.join(projectRoot, 'keyboard.index.js');

      // Verify entry file exists before attempting build
      if (!fs.existsSync(entryFile)) {
        console.error(`[withKeyboardBundle] ⚠ Entry file not found: ${entryFile}`);
        console.error('[withKeyboardBundle] ⚠ Keyboard will NOT render without a bundle!');
        return config;
      }

      const jsBundlePath = path.join(assetsDir, 'keyboard.bundle.js');
      const hbcBundlePath = path.join(assetsDir, 'keyboard.bundle');

      // ── Remove stale bundle to prevent plain-JS bundles from being used ──
      if (fs.existsSync(hbcBundlePath)) {
        const isHBC = isHermesBytecode(hbcBundlePath);
        if (!isHBC) {
          console.warn('[withKeyboardBundle] Removing stale plain-JS keyboard.bundle — must rebuild as Hermes bytecode');
          try { fs.unlinkSync(hbcBundlePath); } catch (e) { /* ignore */ }
        }
      }

      // ── Step 1: Metro bundle (JS) ──────────────────────────────────────────
      console.log('[withKeyboardBundle] Step 1/2: Building keyboard JS bundle via Metro...');

      try {
        execSync(
          `npx react-native bundle --entry-file "${entryFile}" --bundle-output "${jsBundlePath}" --platform android --dev false`,
          {
            cwd: projectRoot,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' },
          }
        );

        if (!fs.existsSync(jsBundlePath)) {
          console.error('[withKeyboardBundle] ⚠ Metro did not produce keyboard.bundle.js');
          return config;
        }

        const jsStats = fs.statSync(jsBundlePath);
        console.log(`[withKeyboardBundle] Metro bundle created: ${(jsStats.size / 1024).toFixed(1)} KB`);

      } catch (error) {
        console.error('[withKeyboardBundle] ⚠ Metro bundle failed:', error.message);
        // Check if there's an existing VALID (HBC) bundle we can keep
        if (fs.existsSync(hbcBundlePath) && isHermesBytecode(hbcBundlePath)) {
          console.warn(`[withKeyboardBundle] Using existing Hermes bytecode keyboard.bundle`);
          return config;
        }
        // No valid bundle exists — this is a build-breaking error
        throw new Error(
          '[withKeyboardBundle] FATAL: Metro bundle failed and no valid Hermes bytecode bundle exists. '
          + 'Keyboard will show BLANK. Fix: ensure react-native CLI is available. Error: ' + error.message
        );
      }

      // ── Step 2: Hermes compilation (HBC) ──────────────────────────────────
      console.log('[withKeyboardBundle] Step 2/2: Compiling to Hermes bytecode...');

      const hermesc = resolveHermesc(projectRoot);
      if (hermesc) {
        try {
          const hermescCmd = path.isAbsolute(hermesc) ? `"${hermesc}"` : hermesc;
          // -Wno-undefined-variable silences Hermes warnings about globals
          // provided by the RN runtime at load time (setTimeout, performance,
          // AbortSignal, Blob, XMLHttpRequest, etc.). The keyboard bundle is
          // strict-mode JS and would otherwise emit a wall of "the variable X
          // was not declared" warnings on every EAS build.
          execSync(
            `${hermescCmd} -emit-binary -Wno-undefined-variable -out "${hbcBundlePath}" "${jsBundlePath}"`,
            {
              cwd: projectRoot,
              stdio: 'inherit',
            }
          );

          const hbcStats = fs.statSync(hbcBundlePath);
          console.log(`[withKeyboardBundle] Hermes bytecode compiled: ${(hbcStats.size / 1024).toFixed(1)} KB`);

          // Clean up the intermediate JS bundle
          try { fs.unlinkSync(jsBundlePath); } catch (e) { /* ignore */ }

        } catch (hermesError) {
          // Clean up intermediate JS bundle
          try { fs.unlinkSync(jsBundlePath); } catch (e) { /* ignore */ }
          throw new Error(
            '[withKeyboardBundle] FATAL: Hermes compilation failed. '
            + 'Keyboard will show BLANK without Hermes bytecode. '
            + 'Error: ' + hermesError.message
          );
        }
      } else {
        // Clean up intermediate JS bundle
        try { fs.unlinkSync(jsBundlePath); } catch (e) { /* ignore */ }
        throw new Error(
          '[withKeyboardBundle] FATAL: hermesc executable NOT FOUND. '
          + 'Install hermes-compiler: npm install hermes-compiler. '
          + 'Without hermesc, the keyboard bundle cannot be compiled to Hermes bytecode '
          + 'and the keyboard will show BLANK.'
        );
      }

      // ── Final verification ────────────────────────────────────────────────
      if (fs.existsSync(hbcBundlePath)) {
        const stats = fs.statSync(hbcBundlePath);
        if (stats.size < 100) {
          console.error(`[withKeyboardBundle] ⚠⚠⚠ WARNING: keyboard.bundle is suspiciously small (${stats.size} bytes) — likely empty or corrupt! ⚠⚠⚠`);
        } else {
          const isHBC = isHermesBytecode(hbcBundlePath);
          if (isHBC) {
            console.log(`[withKeyboardBundle] ✅ Bundle format: Hermes bytecode`);
            console.log(`[withKeyboardBundle] ✅ Final size: ${(stats.size / 1024).toFixed(1)} KB`);
          } else {
            console.error(`[withKeyboardBundle] ⚠⚠⚠ WARNING: Bundle format is PLAIN JS, not Hermes bytecode! ⚠⚠⚠`);
            console.error(`[withKeyboardBundle] ⚠⚠⚠ Hermes runtime will REJECT this bundle — keyboard will show BLANK! ⚠⚠⚠`);
            console.error(`[withKeyboardBundle] ⚠⚠⚠ Fix: Install hermes-compiler and run expo prebuild again ⚠⚠⚠`);
          }
        }
      } else {
        console.error('[withKeyboardBundle] ⚠⚠⚠ CRITICAL: keyboard.bundle does not exist after build! ⚠⚠⚠');
        console.error('[withKeyboardBundle] ⚠⚠⚠ Keyboard will show BLANK — no JS bundle to execute. ⚠⚠⚠');
      }

      return config;
    },
  ]);

  // Reliability net: inject a Gradle task so keyboard.bundle is (re)built
  // during assembleRelease on the EAS worker, independent of prebuild caching.
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = injectKeyboardBundleGradleTask(config.modResults.contents);
    return config;
  });

  return config;
};

module.exports = withKeyboardBundle;
module.exports.injectKeyboardBundleGradleTask = injectKeyboardBundleGradleTask;
