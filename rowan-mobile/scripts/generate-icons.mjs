#!/usr/bin/env node

/**
 * Generate Android launcher icons and splash screens from the Rowan leaf mark.
 * Run: npm run generate-icons
 *
 * The mark is transparent gold, so nothing here paints a dark tile behind it.
 * Keep the background in sync with android/.../values/ic_launcher_background.xml.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const androidRes = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

const BRAND_BG = '#F7F9F7';

/** Adaptive icons use a 108dp canvas where only the middle ~66dp is guaranteed visible. */
const ADAPTIVE_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

/** Legacy icons for launchers below API 26. */
const LEGACY_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

function resolveSourceIcon() {
  // rowan-mark.png first on purpose: assets/app-icon.png is the original
  // artwork with an opaque black background baked in, which would paint a
  // black tile behind the leaf on every icon and splash.
  const candidates = [
    path.join(projectRoot, 'public', 'rowan-mark.png'),
    path.join(projectRoot, 'assets', 'app-icon.png'),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? null;
}

/** Leaf scaled to a given pixel height, on transparent pixels. */
async function renderMark(sharp, source, height) {
  return sharp(source, { density: 512 })
    .resize({ height: Math.round(height), fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function writeComposite(sharp, { size, backgroundSvg, markHeight, source, outFile }) {
  const mark = await renderMark(sharp, source, markHeight);
  const base = backgroundSvg
    ? sharp(Buffer.from(backgroundSvg))
    : sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      });

  await base
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(outFile);
}

async function generateIcons(sharp, source) {
  for (const [dir, size] of Object.entries(ADAPTIVE_SIZES)) {
    const dirPath = path.join(androidRes, dir);
    fs.mkdirSync(dirPath, { recursive: true });

    await writeComposite(sharp, {
      size,
      backgroundSvg: null,
      markHeight: size * 0.5,
      source,
      outFile: path.join(dirPath, 'ic_launcher_foreground.png'),
    });
  }
  console.log(`✓ adaptive foregrounds (${Object.values(ADAPTIVE_SIZES).join(', ')})`);

  for (const [dir, size] of Object.entries(LEGACY_SIZES)) {
    const dirPath = path.join(androidRes, dir);
    fs.mkdirSync(dirPath, { recursive: true });

    const radius = Math.round(size * 0.22);
    await writeComposite(sharp, {
      size,
      backgroundSvg: `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BRAND_BG}"/></svg>`,
      markHeight: size * 0.56,
      source,
      outFile: path.join(dirPath, 'ic_launcher.png'),
    });

    const r = size / 2;
    await writeComposite(sharp, {
      size,
      backgroundSvg: `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="${BRAND_BG}"/></svg>`,
      markHeight: size * 0.52,
      source,
      outFile: path.join(dirPath, 'ic_launcher_round.png'),
    });
  }
  console.log(`✓ legacy icons (${Object.values(LEGACY_SIZES).join(', ')})`);
}

async function generateSplashes(sharp, source) {
  const dirs = fs
    .readdirSync(androidRes, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('drawable'))
    .map((entry) => path.join(androidRes, entry.name, 'splash.png'))
    .filter((file) => fs.existsSync(file));

  if (dirs.length === 0) {
    console.log('• no splash.png files found, skipping');
    return;
  }

  for (const file of dirs) {
    const { width, height } = await sharp(file).metadata();
    // Scale off the short edge so portrait and landscape look the same size.
    const markHeight = Math.min(width, height) * 0.26;
    const mark = await renderMark(sharp, source, markHeight);

    const buffer = await sharp(
      Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${BRAND_BG}"/></svg>`),
    )
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toBuffer();

    fs.writeFileSync(file, buffer);
  }
  console.log(`✓ splash screens (${dirs.length} densities)`);
}

async function main() {
  const source = resolveSourceIcon();
  if (!source) {
    console.error('\n❌ Place the Rowan leaf mark at rowan-mobile/public/rowan-mark.png\n');
    process.exit(1);
  }

  const sharp = (await import('sharp')).default;

  console.log('🎨 Generating Rowan launcher icons and splash screens...\n');
  console.log(`📂 Source: ${path.relative(projectRoot, source)}\n`);

  await generateIcons(sharp, source);
  await generateSplashes(sharp, source);

  console.log('\n✅ Done. Run `npx cap sync android`, uninstall the old app, then rebuild.\n');
}

main().catch((error) => {
  console.error('❌ Icon generation failed:', error.message);
  process.exit(1);
});
