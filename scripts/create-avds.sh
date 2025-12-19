#!/bin/bash
set -e

# Ensure environment variables are set
ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config/avd"

# Create Samsung S24 emulator (Android 14/API 34)
echo ""
echo "Creating Samsung S24 emulator (Android 14)..."

AVD_S24="Samsung_S24"
if avdmanager list avd | grep -q "$AVD_S24"; then
    echo "AVD already exists, deleting old version..."
    avdmanager delete avd -n "$AVD_S24"
fi

echo "no" | avdmanager create avd \
    -n "$AVD_S24" \
    -k "system-images;android-34;google_apis_playstore;x86_64" \
    -d "pixel_7_pro" \
    --force

# Configure S24 hardware profile
S24_CONFIG_DEST="$HOME/.android/avd/${AVD_S24}.avd/config.ini"
S24_CONFIG_SRC="$CONFIG_DIR/s24.ini"

if [ -f "$S24_CONFIG_SRC" ]; then
    echo "Applying hardware configuration from $S24_CONFIG_SRC..."
    cat "$S24_CONFIG_SRC" >> "$S24_CONFIG_DEST"
else
    echo "⚠️  Warning: S24 config file not found at $S24_CONFIG_SRC"
fi

echo "✅ Samsung S24 emulator created"

# Create Latest Android emulator (Android 15/API 35)
echo ""
echo "Creating Latest Android emulator (Android 15)..."

AVD_LATEST="Android_Latest"
if avdmanager list avd | grep -q "$AVD_LATEST"; then
    echo "AVD already exists, deleting old version..."
    avdmanager delete avd -n "$AVD_LATEST"
fi

echo "no" | avdmanager create avd \
    -n "$AVD_LATEST" \
    -k "system-images;android-35;google_apis_playstore;x86_64" \
    -d "pixel_7_pro" \
    --force

echo "✅ Android Latest emulator created"

# Create Samsung S24 emulator (Android 16/API 36)
echo ""
echo "Creating Samsung S24 emulator (Android 16)..."

AVD_S24_16="Samsung_S24_Android16"
if avdmanager list avd | grep -q "$AVD_S24_16"; then
    echo "AVD already exists, deleting old version..."
    avdmanager delete avd -n "$AVD_S24_16"
fi

IMAGE_36_PLAY="system-images;android-36;google_apis_playstore;x86_64"
IMAGE_36_GOOGLE="system-images;android-36;google_apis;x86_64"
SYSTEM_IMAGE_36=""

if sdkmanager --list_installed | grep -q "$IMAGE_36_PLAY"; then
    SYSTEM_IMAGE_36="$IMAGE_36_PLAY"
elif sdkmanager --list_installed | grep -q "$IMAGE_36_GOOGLE"; then
    SYSTEM_IMAGE_36="$IMAGE_36_GOOGLE"
else
    echo "⚠️  Warning: No Android 16 (API 36) system image installed."
    echo "   Run: ./scripts/install-sdk.sh"
    SYSTEM_IMAGE_36="$IMAGE_36_GOOGLE"
fi

echo "no" | avdmanager create avd \
    -n "$AVD_S24_16" \
    -k "$SYSTEM_IMAGE_36" \
    -d "pixel_7_pro" \
    --force

S24_16_CONFIG_DEST="$HOME/.android/avd/${AVD_S24_16}.avd/config.ini"
S24_16_CONFIG_SRC="$CONFIG_DIR/s24.ini"

if [ -f "$S24_16_CONFIG_SRC" ]; then
    echo "Applying hardware configuration from $S24_16_CONFIG_SRC..."
    cat "$S24_16_CONFIG_SRC" >> "$S24_16_CONFIG_DEST"
else
    echo "⚠️  Warning: S24 config file not found at $S24_16_CONFIG_SRC"
fi

echo "✅ Samsung S24 Android 16 emulator created"
