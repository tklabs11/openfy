# Openfy v14 + v15 — Developer Mode / Plugin SDK Preview

- Settings → Desenvolvedor → Developer Mode.
- JSON manifest editor, validation, import/export, local manifest list and removal.
- Explicit allowlist for manifest permissions, file size cap, schema and HTTPS validation.
- Example manifest and SDK documentation under `docs/plugin-sdk/`.
- No third-party JavaScript execution, no plugin runtime, no external marketplace hosting.
- Player and audio engine unchanged; existing online streaming hotfix preserved.

Testing: `npm install`, `npm run typecheck`, `npm run dev`. Test importing `docs/plugin-sdk/example.openfy.json` and exporting it again.
