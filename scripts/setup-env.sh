#!/bin/bash
set -e

# Add environment variables to .bashrc
if ! grep -q "# Android SDK Environment" "$HOME/.bashrc"; then
    echo ""
    echo "Adding Android SDK to ~/.bashrc..."
    cat >> "$HOME/.bashrc" << 'EOF'

# Android SDK Environment
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

# Android Emulator with KVM acceleration
export ANDROID_EMULATOR_USE_SYSTEM_LIBS=1
EOF
    echo "✅ Environment variables added to ~/.bashrc"
else
    echo "✅ Environment variables already in ~/.bashrc"
fi

# Create convenience scripts
echo ""
echo "Creating convenience scripts in ~/.local/bin..."
mkdir -p "$HOME/.local/bin"

# Update script
cat > "$HOME/.local/bin/android-update" << 'EOF'
#!/bin/bash
echo "Updating Android SDK..."
sdkmanager --update
echo ""
echo "Available updates:"
sdkmanager --list_installed
echo ""
echo "To update specific packages: sdkmanager --install <package-name>"
EOF
chmod +x "$HOME/.local/bin/android-update"

# List devices script
cat > "$HOME/.local/bin/android-devices" << 'EOF'
#!/bin/bash
echo "Available Android Virtual Devices:"
echo ""
avdmanager list avd
EOF
chmod +x "$HOME/.local/bin/android-devices"

# Start S24 emulator script
cat > "$HOME/.local/bin/android-s24" << 'EOF'
#!/bin/bash
echo "Starting Samsung S24 emulator..."
echo ""
emulator -avd Samsung_S24 -gpu host -skin 1080x2340 &
EOF
chmod +x "$HOME/.local/bin/android-s24"

# Start Latest Android emulator script
cat > "$HOME/.local/bin/android-latest" << 'EOF'
#!/bin/bash
echo "Starting Android 15 emulator..."
echo ""
emulator -avd Android_Latest -gpu host &
EOF
chmod +x "$HOME/.local/bin/android-latest"

# Quick status script
cat > "$HOME/.local/bin/android-status" << 'EOF'
#!/bin/bash
echo "Android Development Environment Status"
echo "======================================="
echo ""
echo "SDK Location: $ANDROID_HOME"
echo "SDK Version: $(sdkmanager --version 2>/dev/null | head -1)"
echo ""
echo "Installed Platforms:"
sdkmanager --list_installed | grep "platforms;" | sed 's/^/  /'
echo ""
echo "Available Emulators:"
avdmanager list avd | grep "Name:" | sed 's/^/  /'
echo ""
echo "Running Emulators:"
adb devices | grep "emulator" | sed 's/^/  /' || echo "  None"
echo ""
EOF
chmod +x "$HOME/.local/bin/android-status"

echo "✅ Convenience scripts created"
