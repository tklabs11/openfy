#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Instale o Node.js primeiro: https://nodejs.org"; exit 1; }
command -v npm >/dev/null || { echo "npm não encontrado. No Ubuntu/Debian: sudo apt install npm"; exit 1; }
[ -d node_modules ] || npm install
npm run dev
