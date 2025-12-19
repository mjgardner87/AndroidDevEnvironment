#!/bin/bash

# Uninstall script for Android Development Environment

echo "========================================="
echo "WARNING: Android Environment Uninstall"
echo "========================================="
echo ""
echo "This will DELETE:"
echo "  - Android SDK ($HOME/Android/Sdk)"
echo "  - All Emulators and data ($HOME/.android)"
echo "  - Convenience scripts (~/.local/bin/android-*)"
echo ""
read -p "Are you sure you want to proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo "Removing Android SDK..."
rm -rf "$HOME/Android/Sdk"

echo "Removing Android configuration and emulators..."
rm -rf "$HOME/.android"

echo "Removing convenience scripts..."
rm -f "$HOME/.local/bin/android-update"
rm -f "$HOME/.local/bin/android-devices"
rm -f "$HOME/.local/bin/android-s24"
rm -f "$HOME/.local/bin/android-s24-16"
rm -f "$HOME/.local/bin/android-latest"
rm -f "$HOME/.local/bin/android-status"
rm -f "$HOME/.local/bin/android-ui"

echo "Removing desktop shortcuts..."
rm -f "$HOME/.local/share/applications/android-s24.desktop"
rm -f "$HOME/.local/share/applications/android-s24-16.desktop"
rm -f "$HOME/.local/share/applications/android-latest.desktop"
rm -f "$HOME/.local/share/applications/android-manager.desktop"
rm -f "$HOME/.local/share/applications/android-test-console.desktop"

echo "Removing UI files..."
rm -rf "$HOME/.local/share/android-dev-ui"

echo "✅ Cleanup complete."
echo ""
echo "NOTE: To fully clean up, you may want to remove the environment variables"
echo "      from ~/.bashrc manually. Look for '# Android SDK Environment'."
