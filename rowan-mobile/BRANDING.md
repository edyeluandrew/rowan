# Rowan Mobile App Branding

This guide explains how to set up and maintain the Rowan app logo and icons for mobile deployment.

## Logo Assets

### 1. **Favicon** (`public/favicon.svg`)
The main Rowan logo in SVG format. Used for:
- Web favicon (shows in browser tab)
- Source for generating Android icons
- Marketing materials

**Colors:**
- Logo: `#F0B90B` (Rowan Yellow) with gradient to `#FFD700`
- Background: `#000000` (Black)

### 2. **Splash Screen** (`public/splash.svg`)
The launch splash screen shown when the app starts. Displays:
- Rowan logo
- App name "ROWAN"
- Tagline "Stellar Liquidity Bridge"
- Loading indicator

## Icon Generation

### Quick Start

To generate Android app icons from the SVG logo:

```bash
npm install --save-dev sharp
npm run generate-icons
```

This creates PNG icons in the correct sizes for all Android densities:
- `mdpi`: 48×48 (baseline, 160 dpi)
- `hdpi`: 72×72 (240 dpi)
- `xhdpi`: 96×96 (320 dpi)
- `xxhdpi`: 144×144 (480 dpi)
- `xxxhdpi`: 192×192 (640 dpi)

### Manual Alternative

If `sharp` is not available, you can:

1. Use an online SVG-to-PNG converter (e.g., CloudConvert, Convertio)
2. Convert `public/favicon.svg` to PNG at each size
3. Place files in `android/app/src/main/res/mipmap-{density}/`

### Files Generated

```
android/app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png (48×48)
│   └── ic_launcher_round.png (48×48)
├── mipmap-hdpi/
│   ├── ic_launcher.png (72×72)
│   └── ic_launcher_round.png (72×72)
├── mipmap-xhdpi/
│   ├── ic_launcher.png (96×96)
│   └── ic_launcher_round.png (96×96)
├── mipmap-xxhdpi/
│   ├── ic_launcher.png (144×144)
│   └── ic_launcher_round.png (144×144)
└── mipmap-xxxhdpi/
    ├── ic_launcher.png (192×192)
    └── ic_launcher_round.png (192×192)
```

## Splash Screen

The splash screen is configured in `capacitor.config.json`:

```json
{
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 3000,
      "launchAutoHide": true,
      "backgroundColor": "#000000",
      "androidSpin": false,
      "showSpinner": false
    }
  }
}
```

**Display settings:**
- Duration: 3 seconds
- Auto-hide when app is ready
- Black background matching brand
- No spinner (custom splash art displays instead)

## iOS Configuration

For iOS, icons are configured in `ios/App/App/Info.plist`:

```xml
<key>CFBundleIcons</key>
<dict>
  <key>CFBundlePrimaryIcon</key>
  <dict>
    <key>CFBundleIconFiles</key>
    <array>
      <!-- Icons will be generated here -->
    </array>
  </dict>
</dict>
```

To set up iOS icons:

```bash
npx cap sync ios
```

Capacitor will copy the app icon to iOS automatically.

## Build & Deploy

### Android

```bash
npm run cap:build      # Build web + sync to Android
npm run cap:android    # Open Android Studio
```

Then in Android Studio:
1. Build → Build Bundle(s) / APK(s)
2. Icons will be included from the generated mipmap files

### iOS

```bash
npm run cap:build      # Build web + sync to iOS
npm run cap:ios        # Open Xcode
```

Then in Xcode:
1. Update assets in Assets.xcassets
2. Build → Archive
3. Icons are already set

## Customization

To modify the logo:

1. Edit `public/favicon.svg` (in any text editor or design tool)
2. Ensure colors match the brand palette
3. Run `npm run generate-icons` to regenerate all icon sizes
4. Sync to mobile: `npm run cap:sync`

## Brand Colors

- **Primary Yellow**: `#F0B90B` (main action color, accent)
- **Secondary Yellow**: `#FFD700` (gradient highlight)
- **Background**: `#000000` (pure black)
- **Text**: `#FFFFFF` (pure white)
- **Success**: `#0ECB81` (green for confirmations)
- **Error**: `#F6465D` (red for warnings)

## Resources

- [Capacitor Icons & Splashes](https://capacitorjs.com/docs/guides/splashscreens-and-icons)
- [Android Icon Design](https://developer.android.com/guide/practices/ui_guidelines/icon_design)
- [iOS App Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons/)

---

**Last Updated:** May 5, 2026
**Icon Version:** 1.0 (Initial Rowan branding)
