#!/bin/bash
# DevisFlow : lance l'app en continu sur ce Mac (au démarrage de la session) et la met à jour toute seule.
# Utilisation, depuis le dossier DevisFlow :  bash installer-mac.sh
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="ch.devisflow.app"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/DevisFlow.log"
NODE="$(command -v node || true)"
GIT="$(command -v git || true)"

if [ -z "$NODE" ]; then echo "Node.js est introuvable. Installe-le depuis https://nodejs.org puis relance."; exit 1; fi
if [ -z "$GIT" ] || [ ! -d "$DIR/.git" ]; then
  echo "Ce dossier n'a pas été téléchargé avec git clone : les mises à jour automatiques ne marcheront pas."
  echo "Voir LISEZMOI.md, section « Installation »."; exit 1
fi
if [ ! -f "$DIR/.env" ]; then echo "Attention : pas de fichier .env, l'assistant IA sera inactif."; fi

cd "$DIR" && npm install --no-audit --no-fund >/dev/null
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$DIR/scripts/superviseur.js</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$NODE"):$(dirname "$GIT"):/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PL

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 3
if curl -s -o /dev/null http://localhost:3000; then
  echo ""
  echo "C'est installé. DevisFlow tourne en continu : http://localhost:3000"
  echo "Il redémarre tout seul à l'ouverture de ta session et se met à jour depuis GitHub toutes les 2 minutes."
  echo "Journal : $LOG"
  open "http://localhost:3000"
else
  echo "Installé, mais l'app ne répond pas encore. Regarde le journal : $LOG"
  echo "(Si un autre DevisFlow tourne déjà dans un Terminal, arrête-le avec Ctrl + C.)"
fi
