const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function resolveHermesc(projectRoot) {
  const candidates = [];
  const platform = process.platform;
  let osBin;
  if (platform === 'linux') osBin = 'linux64-bin';
  else if (platform === 'darwin') osBin = 'osx-bin';
  else if (platform === 'win32') osBin = 'win64-bin';

  // 1. Try hermes-compiler package
  try {
    const hermesCompilerPkg = require.resolve('hermes-compiler/package.json', { paths: [projectRoot] });
    const hermesDir = path.dirname(hermesCompilerPkg);
    if (osBin) {
      candidates.push(path.join(hermesDir, 'hermesc', osBin, 'hermesc'));
      candidates.push(path.join(hermesDir, 'hermesc', osBin, 'hermesc.exe'));
      candidates.push(path.join(hermesDir, osBin, 'hermesc'));
      candidates.push(path.join(hermesDir, osBin, 'hermesc.exe'));
    }
    candidates.push(path.join(hermesDir, 'hermesc'));
    candidates.push(path.join(hermesDir, 'hermesc.exe'));
  } catch (e) {}

  // 2. Try react-native package
  try {
    const rnPkg = require.resolve('react-native/package.json', { paths: [projectRoot] });
    const rnDir = path.dirname(rnPkg);
    const sdkDir = path.join(rnDir, 'sdks', 'hermesc');
    if (osBin) {
      candidates.push(path.join(sdkDir, osBin, 'hermesc'));
      candidates.push(path.join(sdkDir, osBin, 'hermesc.exe'));
    }
  } catch (e) {}

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
    } catch (e) {}
  }
  return null;
}

function buildKeyboardBundle(projectRoot) {
  const assetsDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const entryFile = path.join(projectRoot, 'keyboard.index.js');
  if (!fs.existsSync(entryFile)) {
    console.error(`[build-keyboard-bundle] Entry file not found: ${entryFile}`);
    process.exit(1);
  }

  const jsBundlePath = path.join(assetsDir, 'keyboard.bundle.js');
  const hbcBundlePath = path.join(assetsDir, 'keyboard.bundle');

  console.log('[build-keyboard-bundle] Step 1/2: Metro JS bundling...');
  const bundleCmd = `npx react-native bundle --entry-file "${entryFile}" --bundle-output "${jsBundlePath}" --platform android --dev false`;
  execSync(bundleCmd, { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });

  if (!fs.existsSync(jsBundlePath)) {
    console.error('[build-keyboard-bundle] Metro failed to produce JS bundle');
    process.exit(1);
  }

  console.log('[build-keyboard-bundle] Step 2/2: Hermes bytecode compilation...');
  const hermesc = resolveHermesc(projectRoot);
  if (!hermesc) {
    console.error('[build-keyboard-bundle] hermesc executable not found!');
    process.exit(1);
  }

  console.log(`[build-keyboard-bundle] Using hermesc: ${hermesc}`);
  const hermescCmd = path.isAbsolute(hermesc) ? `"${hermesc}"` : hermesc;
  // -Wno-undefined-variable silences Hermes warnings about globals provided by
  // the RN runtime at load time (setTimeout, performance, AbortSignal, Blob,
  // XMLHttpRequest, etc.). The keyboard bundle is strict-mode JS and would
  // otherwise emit a wall of "the variable X was not declared" warnings on
  // every EAS build.
  const compileCmd = `${hermescCmd} -emit-binary -Wno-undefined-variable -out "${hbcBundlePath}" "${jsBundlePath}"`;
  execSync(compileCmd, { cwd: projectRoot, stdio: 'inherit' });

  // Remove temporary JS bundle
  try { fs.unlinkSync(jsBundlePath); } catch (e) {}

  // Copy bundled emoji font into assets/fonts. ReactFontManager auto-loads
  // fonts/<FamilyName>.ttf for unregistered families, so fontFamily:
  // 'NotoColorEmoji' in the keyboard resolves to it. Doing this here (and
  // NOT only in the prebuild config plugin) means the font also survives
  // cached/skipped prebuilds — this script runs in the local build flow AND
  // as the Gradle-injected reliability net, so the APK always ships it.
  const srcFontsDir = path.join(projectRoot, 'assets', 'fonts');
  if (fs.existsSync(srcFontsDir)) {
    const targetFontsDir = path.join(assetsDir, 'fonts');
    fs.mkdirSync(targetFontsDir, { recursive: true });
    for (const file of fs.readdirSync(srcFontsDir)) {
      if (!/\.(ttf|otf)$/i.test(file)) continue;
      fs.copyFileSync(path.join(srcFontsDir, file), path.join(targetFontsDir, file));
      console.log(`[build-keyboard-bundle] Copied ${file} to assets/fonts`);
    }
  }

  // Verify Hermes bytecode magic bytes (0xC61FBC03 in little endian)
  const fd = fs.openSync(hbcBundlePath, 'r');
  const magic = Buffer.alloc(8);
  fs.readSync(fd, magic, 0, 8, 0);
  fs.closeSync(fd);

  const isHBC = magic.readUInt32LE(0) === 0x03bc1fc6;
  const stats = fs.statSync(hbcBundlePath);

  console.log(`[build-keyboard-bundle] Bundle created successfully!`);
  console.log(`  Path: ${hbcBundlePath}`);
  console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`  Format: ${isHBC ? 'Hermes Bytecode (HBC) ✓' : 'INVALID/PLAIN JS ✗'}`);

  if (!isHBC) {
    console.error('[build-keyboard-bundle] FATAL: Bundle is not Hermes Bytecode!');
    process.exit(1);
  }
}

if (require.main === module) {
  buildKeyboardBundle(path.resolve(__dirname, '..'));
}

module.exports = { buildKeyboardBundle, resolveHermesc };
