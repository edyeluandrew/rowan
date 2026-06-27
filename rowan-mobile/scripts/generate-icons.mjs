#!/usr/bin/env node

/**
 * Generate Android launcher icons from the Rowan leaf logo (PNG or SVG).
 * Run: npm run generate-icons
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const iconSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

function resolveSourceIcon() {
  const png = path.join(__dirname, '..', 'assets', 'app-icon.png');
  const svg = path.join(__dirname, '..', 'public', 'favicon.svg');
  if (fs.existsSync(png)) return png;
  if (fs.existsSync(svg)) return svg;
  return null;
}

async function renderLogo(sharp, iconPath, size, { paddingRatio = 0.12, transparent = false } = {}) {
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const pad = Math.floor((size - inner) / 2);
  const bg = transparent
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : { r: 0, g: 0, b: 0, alpha: 1 };

  return sharp(iconPath, { density: 512 })
    .resize(inner, inner, { fit: 'contain', background: bg })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg })
    .png()
    .toBuffer();
}

async function main() {
  const iconPath = resolveSourceIcon();
  if (!iconPath) {
    console.error('\n❌ Place the Rowan logo at rowan-mobile/assets/app-icon.png\n');
    process.exit(1);
  }

  const sharp = (await import('sharp')).default;
  const androidResPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

  console.log('🎨 Generating Rowan leaf launcher icons...\n');
  console.log(`📂 Source: ${path.relative(path.join(__dirname, '..'), iconPath)}\n`);

  for (const [dir, size] of Object.entries(iconSizes)) {
    const dirPath = path.join(androidResPath, dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    const launcher = await renderLogo(sharp, iconPath, size, { paddingRatio: 0.1, transparent: false });
    const foreground = await renderLogo(sharp, iconPath, size, { paddingRatio: 0.16, transparent: true });

    await sharp(launcher).toFile(path.join(dirPath, 'ic_launcher.png'));
    await sharp(launcher).toFile(path.join(dirPath, 'ic_launcher_round.png'));
    await sharp(foreground).toFile(path.join(dirPath, 'ic_launcher_foreground.png'));

    console.log(`✓ ${dir} (${size}×${size})`);
  }

  console.log('\n✅ Done. Uninstall the old app, then rebuild in Android Studio.\n');
}

main().catch((error) => {
  console.error('❌ Icon generation failed:', error.message);
  process.exit(1);
});
