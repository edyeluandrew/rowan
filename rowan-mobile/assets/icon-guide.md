# Rowan App Icon Assets

## 📁 Icon Storage

Place your custom Rowan app icon here:

### Main App Icon
**File:** `app-icon.png`
- **Size:** 512×512 pixels (or larger)
- **Format:** PNG with transparency
- **Colors:** Must work on dark background (#000000)
- **Background:** Transparent (no white/color background)

### Example Structure
```
assets/
├── app-icon.png          ← PUT YOUR 512x512 PNG HERE
└── icon-guide.md        (this file)
```

## 🛠️ How to Use

1. **Place your icon here:**
   ```
   rowan-mobile/assets/app-icon.png
   ```

2. **Run the icon generation script:**
   ```bash
   npm run generate-icons
   ```

3. **Generated icons will be created in:**
   ```
   android/app/src/main/res/
   ├── mipmap-mdpi/
   ├── mipmap-hdpi/
   ├── mipmap-xhdpi/
   ├── mipmap-xxhdpi/
   └── mipmap-xxxhdpi/
   ```

## 📋 Icon Specifications Checklist

- ✅ **Size:** 512×512 pixels (minimum)
- ✅ **Format:** PNG
- ✅ **Transparency:** Yes (transparent background)
- ✅ **Padding:** Leave ~10-15% padding around edges
- ✅ **Contrast:** High contrast (works on #000000 background)
- ✅ **Shape:** Fits in circle or square (will scale for both ic_launcher and ic_launcher_round)
- ✅ **Colors:** No pure black (hard to see on #000000 bg) — use colors like gold (#F0B90B), white (#FFFFFF), etc.

## ✨ Best Practices

- **No text** (gets too small on mobile)
- **Simple design** (scales well across sizes)
- **Centered** (icon should be centered in the canvas)
- **Single color or gradient** (easier to recognize at small sizes)

## 🚀 After Generation

Once icons are generated:
1. Test on Android device/emulator
2. Verify icons appear correctly at all sizes
3. Run `npm run cap:sync` to update Capacitor
4. Build APK/AAB for deployment

---

**Ready?** Place your `app-icon.png` here and let me know when it's in! 🎨
