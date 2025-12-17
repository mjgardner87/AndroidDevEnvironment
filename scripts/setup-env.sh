#!/bin/bash
set -e

# Resolve project root (repo folder) so we can install the UI assets.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Install the UI (copy to a stable location under ~/.local/share).
UI_SRC="$PROJECT_ROOT/ui"
UI_DEST="$HOME/.local/share/android-dev-ui"

if [ -d "$UI_SRC" ]; then
    echo ""
    echo "Installing Android Test Console UI to $UI_DEST..."
    rm -rf "$UI_DEST"
    mkdir -p "$UI_DEST"
    # Copy UI sources without dragging along a local node_modules.
    tar -C "$UI_SRC" --exclude node_modules -cf - . | tar -C "$UI_DEST" -xf -
    echo "✅ UI files copied"
else
    echo ""
    echo "⚠️  Warning: UI folder not found at $UI_SRC"
    echo "   You can still use the CLI emulator commands."
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

# Android Test Console (SPA) launcher
cat > "$HOME/.local/bin/android-ui" << 'EOF'
#!/bin/bash
set -e

HOST="${ANDROID_DEV_UI_HOST:-127.0.0.1}"
PORT="${ANDROID_DEV_UI_PORT:-4242}"

UI_DIR="$HOME/.local/share/android-dev-ui"
ANDROID_HOME_DEFAULT="$HOME/Android/Sdk"

if [ ! -d "$UI_DIR" ]; then
  echo "Android UI not installed at: $UI_DIR"
  echo "Re-run ./setup.sh from the AndroidDevEnvironment repo."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is not installed."
  echo "On Fedora: sudo dnf install -y nodejs npm"
  exit 1
fi

# Ensure Android tools are on PATH even when launched from a non-login shell.
if [ -z "${ANDROID_HOME:-}" ]; then
  export ANDROID_HOME="$ANDROID_HOME_DEFAULT"
fi
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found on PATH."
  echo "Expected ANDROID_HOME at: $ANDROID_HOME"
  echo "Re-run ./setup.sh or check ~/.bashrc '# Android SDK Environment'."
  exit 1
fi

if [ ! -d "$UI_DIR/node_modules" ]; then
  echo "Installing UI dependencies (one time)..."
  (cd "$UI_DIR" && npm install)
fi

URL="http://${HOST}:${PORT}"
echo "Starting Android Test Console at ${URL} ..."
echo "Press Ctrl+C to stop."

if command -v xdg-open >/dev/null 2>&1; then
  (sleep 0.6 && xdg-open "$URL" >/dev/null 2>&1) &
fi

ANDROID_DEV_UI_HOST="$HOST" ANDROID_DEV_UI_PORT="$PORT" (cd "$UI_DIR" && npm run start)
EOF
chmod +x "$HOME/.local/bin/android-ui"

echo "✅ Convenience scripts created"
