# Rowan Mobile App Branding

How the Rowan logo, launcher icons and splash screens are set up for mobile.

## Source artwork

**`public/rowan-mark.png`** — the Rowan leaf in gold (`#FFCE09`) on full transparency.
This is the single source for every generated icon and splash.

> `assets/app-icon.png` is the original artwork with an **opaque black background**
> baked in. It is kept for reference only. Do not generate from it — it paints a
> black tile behind the leaf on every icon and splash.

The mark is also used in the app UI through `src/components/RowanLogo.jsx`.

## Generating icons and splashes

```bash
npm run generate-icons
npx cap sync android
```

`scripts/generate-icons.mjs` writes, all from the transparent mark:

| Output | Sizes | Background |
| --- | --- | --- |
| `ic_launcher_foreground.png` | 108, 162, 216, 324, 432 | transparent |
| `ic_launcher.png` | 48, 72, 96, 144, 192 | `#F7F9F7` rounded square |
| `ic_launcher_round.png` | 48, 72, 96, 144, 192 | `#F7F9F7` circle |
| `splash.png` | 11 densities, existing sizes kept | `#F7F9F7` |

Files land in `android/app/src/main/res/{mipmap,drawable}-*/`.

### Why the foreground sizes differ

Adaptive icons (API 26+) draw on a **108dp canvas** where the launcher masks it to a
circle, squircle or rounded square. Only the middle **66dp** is guaranteed visible, so
the leaf is drawn at 50% of the canvas to stay inside that safe zone. The legacy
`ic_launcher.png` files are the smaller unmasked icons for older launchers.

## Background colour

Set in **three** places, keep them in sync:

1. `android/app/src/main/res/values/ic_launcher_background.xml` → adaptive icon background
2. `scripts/generate-icons.mjs` → `BRAND_BG`
3. `capacitor.config.json` → `plugins.SplashScreen.backgroundColor`

All currently `#F7F9F7`, the app background, so the splash blends into the first screen.

## Splash screen

Configured in `capacitor.config.json`:

```json
{
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 3000,
      "launchAutoHide": true,
      "backgroundColor": "#F7F9F7",
      "androidSpin": false,
      "showSpinner": false
    }
  }
}
```

The Android launch theme also points at the same drawable, in
`android/app/src/main/res/values/styles.xml`:

```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="android:background">@drawable/splash</item>
</style>
```

Once the web layer boots, `src/SplashScreen.jsx` takes over with the same mark while
`AuthContext` reads secure storage, so the handoff is seamless.

## Brand colours

Defined in `tailwind.config.cjs` and mirrored as CSS variables in `src/index.css`.

| Token | Value | Use |
| --- | --- | --- |
| `rowan-green` | `#12B81A` | primary actions, brand |
| `rowan-green-dark` | `#087A12` | pressed states |
| `rowan-gold` | `#FFD51F` | the leaf mark, MTN accents |
| `rowan-mint` | `#EAF8EE` | tinted surfaces |
| `rowan-bg` | `#F7F9F7` | app background, icon background |
| `rowan-surface` | `#FFFFFF` | cards |
| `rowan-border` | `#D8E0D9` | hairlines |
| `rowan-text` | `#22272B` | body text |
| `rowan-muted` | `#7B8587` | secondary text |
| `rowan-red` | `#E53935` | errors, Airtel accents |

## Build and deploy

```bash
npm run cap:build      # vite build + cap sync
npm run cap:android    # open Android Studio
```

After changing icons, **uninstall the app from the device first** — Android caches
launcher icons aggressively and a reinstall over the top often keeps the old one.

## iOS

Not generated yet. `npx cap sync ios` copies the web layer, but the icon set in
`ios/App/App/Assets.xcassets` still needs to be produced from the same mark.

## Resources

- [Capacitor icons and splash screens](https://capacitorjs.com/docs/guides/splashscreens-and-icons)
- [Android adaptive icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
