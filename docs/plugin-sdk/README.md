# Openfy Community Plugin SDK — Preview v0.1

This first release provides a **declarative manifest workflow**, not a runtime for third-party JavaScript. Importing a manifest stores metadata in localStorage; it does not execute code, activate features, or grant permissions.

## Create a plugin manifest

Open Settings → Desenvolvedor → Developer Mode. Edit the JSON, validate, and export. Share the exported `.openfy.json` file with the community. Others can load the file and review its metadata and requested permissions before importing.

## Schema

- `schemaVersion`: exactly `1`
- `id`: lowercase letters, digits, dots, hyphens; max 100 chars
- `name`: string max 80
- `version`: semantic version, e.g. `1.0.0`
- `author`: string max 80
- `description`: string max 500
- `kind`: `integration`, `visualizer`, `utility`
- `permissions`: array containing only `library.read`, `player.read`, `theme.read`
- `homepage`: optional HTTPS URL

See `example.openfy.json`.

## Security

No eval, dynamic imports, plugin HTML, external CSS or executable scripts are loaded. Permissions are descriptive only. Never install arbitrary Electron/Node packages supplied by strangers. Future runtime extensions require isolation, capability enforcement, and a security review. Discord sharing does not remove copyright or malware risks.
