#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Instale o Node.js primeiro: https://nodejs.org"; exit 1; }
npm install && npm run dev
