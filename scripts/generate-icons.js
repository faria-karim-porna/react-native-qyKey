// One-off: regenerate corrupted PNG assets (previous files were mangled CRLF->LF).
// Renders all app icons from SVG via sharp. Run: node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'assets');

// Keycap motif: rounded keycap with a 3x3 key grid + spacebar (no fonts needed)
function keycapGlyph(size, keyFill) {
  // design space is 1024x1024, scaled to `size`
  const s = size / 1024;
  const caps = [];
  const positions = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) positions.push([196 + c * 164, 232 + r * 164]);
  }
  for (const [x, y] of positions) {
    caps.push(
      `<rect x="${x}" y="${y}" width="132" height="132" rx="28" fill="${keyFill}" opacity="0.95"/>`
    );
  }
  return `<g transform="scale(${s})">
    <rect x="112" y="88" width="800" height="800" rx="180" fill="url(#capFace)"/>
    <rect x="112" y="88" width="800" height="800" rx="180" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="14"/>
    <rect x="112" y="700" width="800" height="120" rx="48" fill="${keyFill}" opacity="0.95"/>
    ${caps.join('\n    ')}
  </g>`;
}

function svg({ bg, gradient, glyph }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${gradient[0]}"/>
      <stop offset="1" stop-color="${gradient[1]}"/>
    </linearGradient>
    <linearGradient id="capFace" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  ${bg}
  ${glyph}
</svg>`;
}

async function renderPng(svgString, outPath, size = 1024, transparent = false) {
  const img = sharp(Buffer.from(svgString), { density: 96 }).resize(size, size);
  const png = transparent ? img.png({ compressionLevel: 9 }) : img.flatten().png({ compressionLevel: 9 });
  await png.toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(`wrote ${path.relative(process.cwd(), outPath)} ${meta.width}x${meta.height}`);
}

(async () => {
  // 1) App icon: full-bleed gradient + keycap
  const iconSvg = svg({
    gradient: ['#4f7cff', '#1a2b6b'],
    bg: `<rect width="1024" height="1024" fill="url(#bg)"/>`,
    glyph: keycapGlyph(1024, '#0a1030'),
  });
  await renderPng(iconSvg, path.join(ASSETS, 'icon.png'), 1024);

  // 2) Adaptive icon foreground: keycap only, transparent background (safe zone centered ~66%)
  const fgSvg = svg({
    gradient: ['#4f7cff', '#1a2b6b'],
    bg: '',
    glyph: `<g transform="translate(512 512) scale(0.62) translate(-512 -512)">
      ${keycapGlyph(1024, '#ffffff')}
    </g>`,
  });
  await renderPng(fgSvg, path.join(ASSETS, 'android-icon-foreground.png'), 1024, true);

  // 3) Adaptive icon background: plain gradient
  const bgOnlySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f7cff"/><stop offset="1" stop-color="#1a2b6b"/>
    </linearGradient></defs>
    <rect width="1024" height="1024" fill="url(#bg)"/>
  </svg>`;
  await renderPng(bgOnlySvg, path.join(ASSETS, 'android-icon-background.png'), 1024);

  // 4) Monochrome layer: white keycap silhouette on transparent
  const monoSvg = svg({
    gradient: ['#000000', '#000000'],
    bg: '',
    glyph: `<g transform="translate(512 512) scale(0.62) translate(-512 -512)">
      ${keycapGlyph(1024, '#ffffff')}
    </g>`,
  });
  await renderPng(monoSvg, path.join(ASSETS, 'android-icon-monochrome.png'), 1024, true);

  // 5) Splash icon: keycap on transparent (app.json uses backgroundColor via system-ui/splash)
  const splashSvg = svg({
    gradient: ['#4f7cff', '#1a2b6b'],
    bg: '',
    glyph: `<g transform="translate(512 512) scale(0.8) translate(-512 -512)">
      ${keycapGlyph(1024, '#ffffff')}
    </g>`,
  });
  await renderPng(splashSvg, path.join(ASSETS, 'splash-icon.png'), 1024, true);

  // 6) Favicon: small square version of the app icon
  await renderPng(iconSvg, path.join(ASSETS, 'favicon.png'), 48);

  console.log('Done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
