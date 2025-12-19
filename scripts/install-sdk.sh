#!/bin/bash
set -e

ANDROID_SDK_ROOT="$HOME/Android/Sdk"
echo "Setting up Android SDK at: $ANDROID_SDK_ROOT"

mkdir -p "$ANDROID_SDK_ROOT"

# Fix common cmdline-tools layout drift (sdkmanager expects cmdline-tools/latest).
if [ -d "$ANDROID_SDK_ROOT/cmdline-tools/latest-2" ] && [ ! -d "$ANDROID_SDK_ROOT/cmdline-tools/latest" ]; then
    echo "Fixing cmdline-tools path (latest-2 -> latest)..."
    ln -s "$ANDROID_SDK_ROOT/cmdline-tools/latest-2" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
fi

# Download Android command line tools
if [ ! -d "$ANDROID_SDK_ROOT/cmdline-tools/latest" ]; then
    echo ""
    echo "Downloading Android SDK command line tools..."

    CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
    DOWNLOAD_DIR="/tmp/android-cmdline-tools-$$"

    mkdir -p "$DOWNLOAD_DIR"
    curl -L "$CMDLINE_TOOLS_URL" -o "$DOWNLOAD_DIR/cmdline-tools.zip"

    echo "Extracting..."
    unzip -q "$DOWNLOAD_DIR/cmdline-tools.zip" -d "$DOWNLOAD_DIR"

    mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools/latest"
    mv "$DOWNLOAD_DIR/cmdline-tools"/* "$ANDROID_SDK_ROOT/cmdline-tools/latest/"

    rm -rf "$DOWNLOAD_DIR"
    echo "✅ Command line tools installed"
else
    echo "✅ Command line tools already installed"
fi

# Set environment variables for this script execution
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

echo ""
echo "Installing Android SDK packages..."
echo "This will download ~3GB and take 10-15 minutes..."
echo ""

# Accept all licenses
yes | sdkmanager --licenses 2>/dev/null || true

# Install SDK packages
# Using Android 34 (baseline), 35 (latest-ish), and 36 (Android 16)
sdkmanager --install \
    "platform-tools" \
    "platforms;android-34" \
    "platforms;android-35" \
    "platforms;android-36" \
    "build-tools;34.0.0" \
    "build-tools;35.0.0" \
    "build-tools;36.0.0" \
    "system-images;android-34;google_apis_playstore;x86_64" \
    "system-images;android-35;google_apis_playstore;x86_64" \
    "system-images;android-36;google_apis_playstore;x86_64" \
    "emulator" \
    "cmdline-tools;latest"

# Fallbacks if Google Play system image isn't available for a given API level.
sdkmanager --list_installed | grep -q "system-images;android-36;google_apis_playstore;x86_64" || \
    sdkmanager --install "system-images;android-36;google_apis;x86_64" || true

echo ""
echo "✅ SDK packages installed"
