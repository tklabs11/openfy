# Contribuindo com o Openfy

Obrigado por ajudar a construir o Openfy! 💜

## Antes de começar

1. Abra uma issue para bugs, melhorias maiores ou propostas de novas fontes.
2. Faça um fork e crie uma branch descritiva (`fix/...` ou `feat/...`).
3. Rode `npm ci`, `npm run typecheck` e `npm run build`.
4. Envie um pull request explicando a mudança e como testá-la.

## Boas práticas

- Não envie tokens, segredos, credenciais, arquivos de cache nem dados pessoais.
- Não inclua músicas protegidas por direitos autorais sem autorização.
- Respeite os termos e licenças de cada fonte de áudio.
- Plugins e temas devem documentar permissões e dependências.
- Mudanças em Electron/IPC precisam preservar validação de entradas e isolamento entre processos.

Consulte `docs/plugin-sdk/README.md` para começar a explorar extensões.
