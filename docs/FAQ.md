# QyKey Keyboard — FAQ

---

## 1. Can I use this keyboard in my Xiaomi POCO M3 device?

**Yes, absolutely.** Here's why:

- **Android-only app** — The project is exclusively for Android (`"platforms": ["android"]` in `app.json`).
- **Min SDK 26 (Android 8.0 Oreo)** — The POCO M3 ships with Android 10/11, so you're well above the minimum requirement.
- **Requires standard permissions** — Only `VIBRATE` permission is needed. No special hardware required.

**One caveat specific to Xiaomi/MIUI devices:** You'll need to manually enable the keyboard in system settings after installing. Xiaomi's MIUI can be a bit more restrictive about third-party IMEs:

1. Go to **Settings → Additional Settings → Languages & input → Current keyboard → Choose keyboard**
2. Toggle **QyKey** on

---

## 2. How can I test the app?

There are two parts to test:

### A. Companion App (Expo Router UI — onboarding, settings, themes, etc.)

```sh
# Install dependencies
npm install

# Compile dictionary files (needed before first build)
python3 scripts/compile_dictionaries.py

# Run on a connected Android device/emulator
npm run android
```

This launches the companion app on your phone where you can:
- Go through the 3-step onboarding wizard
- Toggle settings (haptic, sound, autocorrect)
- Switch themes (Dark/Light/AMOLED)
- Adjust key height, border radius, font size
- Switch between English/Bangla
- Manage custom dictionary words

### B. Keyboard (IME Service)

After the companion app is installed, you need to **enable the keyboard** in Android settings:
1. Open the app → Complete onboarding → It guides you to enable the keyboard.
2. Or manually: **Settings → System → Languages & input → On-screen keyboard → QyKey**.
3. Then open any messaging app, tap a text field, and use the keyboard switcher icon (globe / keyboard icon in the bottom nav bar) to select **QyKey**.

### C. Building for Distribution

```sh
# Development APK (for testing)
eas build --platform android --profile development

# Production AAB (for Play Store)
eas build --platform android --profile production
```

### Quick Tip for Rapid Iteration

`npm run android` does a full rebuild. For quicker testing of the companion app UI changes, you can use Expo's fast refresh — just keep the dev server running.

---

## 3. Can I test this using builds on the Expo dashboard?

**Yes, absolutely.** This project is fully configured for **EAS Build** (Expo's cloud build service), which you can trigger from the [Expo Dashboard](https://expo.dev).

### What's already configured:

The `eas.json` file has **three build profiles** ready to go:

| Profile | Output | Use case |
|---|---|---|
| `development` | Debug APK (`assembleDebug`) | Testing on your phone via side-loading |
| `preview` | Release APK | Sharing with testers |
| `production` | AAB (Android App Bundle) | Play Store release |

### How to do it:

1. **Link your project** — Go to [expo.dev](https://expo.dev), create an account if you don't have one, and create a new project. Then in your terminal:
   ```sh
   npx eas init   # Links this local project to your Expo account
   npx eas whoami # Verify you're logged in
   ```

2. **Trigger a build** — From the Expo dashboard, you can click **"Build"** → select profile → start. Or from the CLI:
   ```sh
   npx eas build --platform android --profile development
   ```

3. **Install the APK on your POCO M3** — Once the build finishes, EAS gives you a download link. Download the APK and open it on your phone to install.

### Important notes for this project:

- This is a **"development build"** (not Expo Go) — it has custom native modules (IME service, keyboard bundle), so it **can't** be tested in Expo Go.
- Before first build, make sure to run:
  ```sh
  python3 scripts/compile_dictionaries.py   # Builds the dictionary .bin files
  ```
- The build may take **5–15 minutes** on EAS cloud servers.
- EAS Build has a **free tier** with limited monthly builds — enough for personal development.
