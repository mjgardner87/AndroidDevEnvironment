#!/bin/bash

# Android Development Environment Setup
# Orchestrates the setup process by calling modular scripts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

echo "========================================="
echo "Android Development Environment Setup"
echo "========================================="
echo ""
echo "This will set up:"
echo "  - Android SDK with latest platform tools"
echo "  - Samsung S24 emulator (Android 14)"
echo "  - Latest Android 15 emulator"
echo "  - KVM hardware acceleration"
echo "  - Complete development toolchain"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Make scripts executable
chmod +x "$SCRIPTS_DIR"/*.sh

# Run steps
"$SCRIPTS_DIR/install-deps.sh"
"$SCRIPTS_DIR/install-sdk.sh"
"$SCRIPTS_DIR/create-avds.sh"
"$SCRIPTS_DIR/setup-env.sh"
"$SCRIPTS_DIR/create-desktop-entries.sh"

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "🔄 IMPORTANT: You must log out and back in (or reboot)"
echo "   to activate KVM permissions for hardware acceleration"
echo ""
echo "📱 Available Emulators:"
echo "   1. Samsung S24 (Android 14) - Matches your phone"
echo "   2. Android Latest (Android 15) - Latest features"
echo ""
echo "🚀 Quick Commands:"
echo "   android-s24        - Start Samsung S24 emulator"
echo "   android-latest     - Start Android 15 emulator"
echo "   android-devices    - List all emulators"
echo "   android-update     - Update Android SDK"
echo "   android-status     - Show environment status"
echo "   android-ui         - Start the Android Test Console (UI)"
echo ""
