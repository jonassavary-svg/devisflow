#!/bin/bash
# Arrête DevisFlow et le retire du démarrage automatique. Tes données (dossier data/) sont gardées.
LABEL="ch.devisflow.app"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "DevisFlow est arrêté et ne démarrera plus tout seul."
