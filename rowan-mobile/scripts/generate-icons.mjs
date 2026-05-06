#!/usr/bin/env node

/**
 * Generate Android app icons from custom PNG logo
 * Run: npm run generate-icons
 * 
 * Prerequisites:
 * - Place your 512x512 PNG icon at: rowan-mobile/assets/app-icon.png
 * - Icon should have transparent background
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define icon sizes for different Android densities
const iconSizes = {
  'mipmap-hdpi': 72,
  'mipmap-mdpi': 48,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

/**
 * Generate icon from PNG using sharp
 */
async function generateIcon(iconPath, size, outputDir, filename) {
  try {
    const sharp = (await import('sharp')).default;
    
    const outputPath = path.join(outputDir, filename);
    
    // Resize PNG to exact size, preserving transparency
    await sharp(iconPath)
      .resize(size, size, { 
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 } // Black background (opaque)
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated ${filename} (${size}×${size})`);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error(`✗ Sharp not installed. Run: npm install --save-dev sharp`);
      process.exit(1);
    } else {
      console.error(`✗ Error generating ${filename}:`, error.message);
      process.exit(1);
    }
  }
}

/**
 * Main function
 */
async function main() {
  const iconPath = path.join(__dirname, '..', 'assets', 'app-icon.png');
  
  // Check if icon exists
  if (!fs.existsSync(iconPath)) {
    console.error(`\n❌ Icon not found at: ${iconPath}\n`);
    console.error('📋 Setup instructions:');
    console.error('   1. Place your 512×512 PNG icon at: rowan-mobile/assets/app-icon.png');
    console.error('   2. Icon must have transparent background');
    console.error('   3. Run: npm run generate-icons\n');
    process.exit(1);
  }

  console.log('🎨 Generating Rowan app icons from custom PNG...\n');
  console.log(`📂 Source: assets/app-icon.png`);
  console.log(`📍 Destination: android/app/src/main/res/\n`);
  
  const androidResPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  
  // Generate PNG icons for each density
  for (const [dir, size] of Object.entries(iconSizes)) {
    const dirPath = path.join(androidResPath, dir);
    
    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created ${dir}/`);
    }
    
    // Generate ic_launcher.png
    await generateIcon(iconPath, size, dirPath, 'ic_launcher.png');
    
    // Generate ic_launcher_round.png (same as launcher for now)
    await generateIcon(iconPath, size, dirPath, 'ic_launcher_round.png');
  }
  
  console.log('\n✅ Icon generation complete!');
  console.log('📱 Icons are ready for Android deployment');
  console.log('\n🚀 Next steps:');
  console.log('   npm run cap:sync    - Sync to Capacitor');
  console.log('   npm run cap:android - Open Android Studio\n');
}

main().catch(error => {
  console.error('❌ Icon generation failed:', error);
  process.exit(1);
});
