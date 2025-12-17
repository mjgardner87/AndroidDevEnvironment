# Android Development Environment for Fedora

A production-grade Android development setup optimised for testing apps on your Fedora workstation before deploying to your Samsung S24.

## What This Provides

✅ **Two Emulators:**
- **Samsung S24** - Android 14, matches your actual phone
- **Android Latest** - Android 15, for testing cutting-edge features

✅ **Full Development Toolchain:**
- Android SDK with platform tools
- Build tools for multiple Android versions
- ADB (Android Debug Bridge)
- KVM hardware acceleration for fast emulation

✅ **Easy Maintenance:**
- Simple update commands
- Version-controlled SDK packages
- Automated emulator creation

## Quick Start

### 1. Initial Setup (One Time)

```bash
cd AndroidDevEnvironment
chmod +x setup.sh
./setup.sh
```

**What it does:**
- Installs Java JDK 17
- Installs KVM/QEMU for hardware acceleration
- Downloads Android SDK (~3GB)
- Creates two emulators
- Adds convenience commands

**Time:** 15-20 minutes

**After setup:** Log out and back in (for KVM permissions)

### 2. Start an Emulator

**Option A: App Menu (Easiest)**
1. Press the **Super/Windows key** to open your app launcher.
2. Type "Samsung" or "Android".
3. Click **Samsung S24 Emulator**.

**Option B: Terminal**
```bash
android-s24
```

The emulator window will open. Wait 2-3 minutes for first boot.

### 3. Deploy Your App

Open a terminal (or your IDE) to your app folder:

```bash
cd /path/to/your/app
npm run android
```

The app installs and launches automatically on the running emulator.

## Available Commands

After setup, these commands are available system-wide:

### `android-s24`
Start Samsung S24 emulator (Android 14)

### `android-latest`
Start Android 15 emulator with latest features

### `android-devices`
List all available Android Virtual Devices

### `android-update`
Update Android SDK and all installed packages

### `android-status`
Show current environment status, installed packages, running emulators

### `android-ui`
Start the Android Test Console (local SPA) with:
- Emulator/device screen rendered in the centre
- Click-to-tap and drag-to-swipe input
- Emulator controls and app install/launch actions
- Live logcat panel
- Saved app profiles (APK path, package name, deep link)
- Conditions panel (Wi‑Fi/Data toggles, emulator network shaping, geo, battery, theme/locale/font)

## Emulator Controls

### Mouse Interaction
- **Click** = Touch/Tap
- **Click and Drag** = Swipe
- **Scroll Wheel** = Scroll content
- **Right Click** = Context menu (on some apps)

### Keyboard
- Works normally for text input
- **Esc** = Back button
- **Home** = Home button (if enabled)

### Side Panel
- 🔄 **Rotate** - Switch portrait/landscape
- 🔊 **Volume** - Volume up/down
- ⚡ **Power** - Power button/lock screen
- 🏠 **Home** - Return to home screen
- ◀️ **Back** - Navigate back
- 📷 **Camera** - Take screenshot
- ⋮ **More** - Additional controls (location, battery, etc.)

## Samsung S24 Emulator Specs

Configured to match your actual Samsung S24:

- **Android Version:** 14 (API 34)
- **Screen:** 1080x2340, 425 DPI (6.2")
- **RAM:** 8GB
- **Storage:** 8GB
- **Features:** Camera, GPS, Sensors, Audio

## Android Latest Emulator Specs

For testing newest Android features:

- **Android Version:** 15 (API 35)
- **Device Profile:** Pixel 8 Pro
- **Features:** All latest Android 15 APIs

## Updating the Environment

### Update SDK Packages

```bash
android-update
```

This updates:
- Platform tools (adb, fastboot)
- Build tools
- System images
- Emulator itself

### Update to Newer Android Version

When Android 16 is released:

```bash
sdkmanager --install "platforms;android-36"
sdkmanager --install "system-images;android-36;google_apis_playstore;x86_64"

# Recreate latest emulator
avdmanager delete avd -n Android_Latest
echo "no" | avdmanager create avd \
    -n Android_Latest \
    -k "system-images;android-36;google_apis_playstore;x86_64" \
    -d "pixel_9_pro"
```

Or just re-run `./setup.sh` (it updates automatically).

## Testing Workflow

### For New Apps (e.g., Breathing App)

1. **Start emulator:**
   ```bash
   android-s24  # Use S24 to match your phone
   ```

2. **Wait for boot** (2-3 minutes first time)

3. **Deploy app:**
   ```bash
   cd ~/Documents/BreathingApp
   npm run android
   ```

4. **Test thoroughly:**
   - All UI interactions
   - Audio playback
   - Data persistence
   - Performance
   - Crashes/errors

5. **Check logs:**
   ```bash
   adb logcat | grep -i "error\|crash"
   ```

6. **Verify on real device only after emulator testing passes**

## Android Test Console (UI)

The UI is a focused testing cockpit: the emulator canvas sits in the centre, with controls around it so you don’t bounce between windows.

### Start the UI

```bash
android-ui
```

It will open a browser at `http://127.0.0.1:4242`.

### Notes
- The canvas uses `adb exec-out screencap -p`, so it’s not a perfect real-time stream, but it’s responsive enough for functional testing.
- For lower latency, set Interval to ~150–250ms (CPU permitting).
- App profiles are stored locally in your browser (localStorage). Use Export/Import to move them between machines.

### For Existing Apps

1. Install APK on emulator:
   ```bash
   adb install path/to/app.apk
   ```

2. Launch manually from app drawer

3. Test all features

## Performance Optimisation

### Enable KVM Acceleration

Already configured! KVM makes the emulator 10x faster.

Verify KVM is working:
```bash
kvm-ok  # Should show "KVM acceleration can be used"
```

### Allocate More RAM

Edit `~/.android/avd/Samsung_S24.avd/config.ini`:
```ini
hw.ramSize=12288  # 12GB instead of 8GB
```

### Use GPU Acceleration

Already enabled with `-gpu host` flag in launch scripts.

## Troubleshooting

### Emulator won't start

**Check KVM permissions:**
```bash
groups | grep libvirt  # Should show libvirt
```

If not, log out and back in.

### Emulator is slow

**Verify hardware acceleration:**
```bash
emulator -accel-check
```

Should show "KVM is installed and usable".

### App won't install

**Check if emulator is ready:**
```bash
adb devices
# Should show: emulator-5554  device
```

If shows "offline" or "unauthorized", wait longer.

### Black screen on emulator

Try software rendering:
```bash
emulator -avd Samsung_S24 -gpu swiftshader_indirect
```

### "SDK location not found" when building

**Create local.properties in your app:**
```bash
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
```

## Disk Space Management

### Current Usage
- Android SDK: ~5GB
- Each emulator: ~8GB
- Total: ~20GB

### Clean Up Old Packages

```bash
# List all installed packages
sdkmanager --list_installed

# Uninstall old build tools
sdkmanager --uninstall "build-tools;33.0.0"

# Delete unused system images
sdkmanager --uninstall "system-images;android-33;google_apis;x86_64"
```

### Delete an Emulator

```bash
avdmanager delete avd -n Android_Latest
```

## Directory Structure

```
AndroidDevEnvironment/
├── setup.sh                # Main setup script
├── uninstall.sh            # Cleanup script
├── config/                 # Configuration files
│   └── avd/
│       └── s24.ini         # Hardware config for S24
├── ui/                     # Android Test Console (local SPA + server)
└── scripts/                # Helper scripts
    ├── install-deps.sh     # System dependencies
    ├── install-sdk.sh      # SDK download and install
    ├── create-avds.sh      # Emulator creation
    ├── setup-env.sh        # Environment variables and aliases
    └── create-desktop-entries.sh # GNOME/Linux desktop shortcuts
```

## Integration with IDEs

### Android Studio
Point to existing SDK at `~/Android/Sdk`

### VS Code
Install "React Native Tools" extension, it will detect SDK automatically.

### IntelliJ IDEA
File → Project Structure → SDK Location → `~/Android/Sdk`

## Uninstalling

If you want to remove everything:

```bash
./uninstall.sh
```
