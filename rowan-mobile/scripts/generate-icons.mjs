#!/usr/bin/env node

/**
 * Generate Android launcher icons from the Rowan logo (SVG or PNG).
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
  const svg = path.join(__dirname, '..', 'public', 'favicon.svg');
  const png = path.join(__dirname, '..', 'assets', 'app-icon.png');
  if (fs.existsSync(png)) return png;
  if (fs.existsSync(svg)) return svg;
  return null;
}

async function generateIcon(sharp, iconPath, size, outputPath) {
  await sharp(iconPath, { density: 512 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toFile(outputPath);
}

async function main() {
  const iconPath = resolveSourceIcon();

  if (!iconPath) {
    console.error('\n❌ No icon source found.\n');
    console.error('Expected public/favicon.svg or assets/app-icon.png\n');
    process.exit(1);
  }

  const sharp = (await import('sharp')).default;
  const androidResPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

  console.log('🎨 Generating Rowan launcher icons...\n');
  console.log(`📂 Source: ${path.relative(path.join(__dirname, '..'), iconPath)}`);
  console.log(`📍 Destination: android/app/src/main/res/\n`);

  for (const [dir, size] of Object.entries(iconSizes)) {
    const dirPath = path.join(androidResPath, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      const outputPath = path.join(dirPath, name);
      await generateIcon(sharp, iconPath, size, outputPath);
      console.log(`✓ ${dir}/${name} (${size}×${size})`);
    }
  }

  console.log('\n✅ Rowan launcher icons generated.');
  console.log('   npm run cap:sync');
  console.log('   npm run cap:android\n');
}

main().catch((error) => {
  console.error('❌ Icon generation failed:', error.message);
  process.exit(1);
});
