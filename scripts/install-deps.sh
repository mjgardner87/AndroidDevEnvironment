#!/bin/bash
set -e

echo "Installing system dependencies..."

if ! command -v dnf &> /dev/null; then
    echo "Error: 'dnf' package manager not found. This script is optimized for Fedora."
    exit 1
fi

sudo dnf install -y \
    java-17-openjdk \
    java-17-openjdk-devel \
    qemu-kvm \
    libvirt \
    virt-manager \
    unzip \
    curl \
    nodejs \
    npm

# Add user to libvirt group for KVM access
echo ""
echo "Configuring KVM access..."
if ! groups $USER | grep -q libvirt; then
    sudo usermod -a -G libvirt $USER
    echo "✅ Added $USER to libvirt group"
    echo "⚠️  NOTE: You will need to log out and back in for KVM permissions to take effect."
else
    echo "✅ User is already in libvirt group"
fi
