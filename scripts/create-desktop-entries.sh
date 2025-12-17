#!/bin/bash
set -e

# Directory for user-specific desktop entries
APPLICATIONS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPLICATIONS_DIR"

# Path to the icon (we'll use a standard system icon for now, or download one if needed)
# Using standard 'phone' or 'smartphone' icon usually available in Linux themes
ICON_NAME="phone"

echo "Creating desktop shortcuts in $APPLICATIONS_DIR..."

# 1. Samsung S24 Emulator Shortcut
cat > "$APPLICATIONS_DIR/android-s24.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Samsung S24 Emulator
Comment=Start the Android 14 (Samsung S24) Emulator
Exec=$HOME/.local/bin/android-s24
Icon=smartphone
Terminal=false
Categories=Development;
EOF

# 2. Android Latest Emulator Shortcut
cat > "$APPLICATIONS_DIR/android-latest.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Android 15 Emulator
Comment=Start the Android 15 (Latest) Emulator
Exec=$HOME/.local/bin/android-latest
Icon=smartphone
Terminal=false
Categories=Development;
EOF

# 3. Android Manager (Terminal)
cat > "$APPLICATIONS_DIR/android-manager.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Android SDK Manager
Comment=Check status and update Android SDK
Exec=gnome-terminal -- /bin/bash -c "$HOME/.local/bin/android-status; echo ''; read -p 'Press Enter to close...' "
Icon=system-software-update
Terminal=false
Categories=Development;
EOF

# 4. Android Test Console (SPA)
cat > "$APPLICATIONS_DIR/android-test-console.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Android Test Console
Comment=Slick console for emulator canvas + controls
Exec=gnome-terminal -- /bin/bash -lc "$HOME/.local/bin/android-ui"
Icon=applications-development
Terminal=false
Categories=Development;
EOF

# Update desktop database to ensure icons appear immediately
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$APPLICATIONS_DIR"
fi

echo "✅ Desktop shortcuts created! You can now search for 'Samsung' or 'Android' in your app menu."
