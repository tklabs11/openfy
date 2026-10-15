# Openfy

Player de música desktop (Electron + React + TypeScript), código aberto (MIT), visual inspirado em apps de streaming.

## Fontes de música
- **Audius**: stream completo, sem chave.
- **Jamendo**: Creative Commons, precisa de um `client_id` gratuito (opcional).
- **Openverse**: catálogo de músicas com licença aberta, sem chave (acesso anônimo com limite de uso).
- **Internet Archive**: áudio com licença Creative Commons, sem chave.
- **Arquivos locais**: mp3, flac, wav, ogg, m4a, aac, opus via "Músicas salvas".

A busca roda dentro do app (processo principal) e mistura as fontes. Não existe servidor.
Veja `docs/LICENSES.md`.

## Configuração (uma vez, antes de gerar o instalador)
Só o Jamendo usa chave. Crie um `client_id` grátis em https://devportal.jamendo.com e
coloque em `src/shared/config.ts` (`JAMENDO_CLIENT_ID`), ou rode `CONFIGURAR-JAMENDO.bat` no Windows.
Sem ele, o app funciona com as outras fontes. Para testar sem editar arquivo:
`OPENFY_JAMENDO_CLIENT_ID=seu_id npm run dev`.

## Rodar
Veja `COMO-USAR.txt` (Windows: dois cliques em `INSTALAR-E-RODAR.bat`). Ou:
```bash
npm ci
npm run dev      # desenvolvimento
npm run dist     # instalador em dist/
```

## Estrutura
```
src/main/sources  Audius, Jamendo, Openverse, Internet Archive e a mistura dos resultados
src/main          janela, IPC, protocolo para arquivos locais, salvamento
src/preload       ponte segura
src/shared        tipos e config (JAMENDO_CLIENT_ID)
src/renderer      interface React (views, componentes, player, biblioteca)
```

## Atalhos
Espaço = play/pause. Teclas de mídia do teclado funcionam.

## Discord Rich Presence

Ative em **Configurações → Desktop → Discord Rich Presence** para mostrar no Discord a faixa e o artista reproduzidos no Openfy. O Discord precisa estar aberto, e a exibição da atividade depende das configurações de privacidade do próprio Discord. A integração fica desativada por padrão.

## Atualizações automáticas (Windows)

As versões instaladas no Windows verificam atualizações publicadas em GitHub Releases. A verificação também pode ser iniciada em **Configurações → Desktop**; quando uma atualização é encontrada, o app a baixa e oferece reiniciar para instalar. Versões beta recebem versões beta e estáveis recebem apenas versões estáveis.

Para publicar uma versão Windows, crie uma tag `v` igual à versão do `package.json` (por exemplo, `v0.1.1-beta.2`) e envie-a ao GitHub. O workflow de release gera o instalador NSIS e publica os arquivos na release correspondente.

## Notas
- Playlists e músicas salvas ficam em `openfy-data.json` na pasta de dados do app.
- Dados antigos de faixas de fontes removidas são descartados ao abrir o app.

## Projeto público e contribuições

- [Como contribuir](CONTRIBUTING.md)
- [Segurança](SECURITY.md)
- [Código de conduta](CODE_OF_CONDUCT.md)
- [Licença MIT](LICENSE)
- [Histórico de atualizações e hotfixes](docs/history/)

### Primeiro clone

```bash
git clone https://github.com/tklabs11/openfy.git
cd openfy
npm ci
npm run dev
```

## Créditos

- **TK** — criador do Openfy, direção do projeto, desenvolvimento e decisões de produto.
- **ChatGPT (OpenAI)** — assistência de IA no desenvolvimento, depuração, documentação e organização do projeto.
- **Comunidade Openfy** — futuras contribuições de código, temas, plugins e documentação.

O Openfy é um projeto independente, não afiliado nem endossado pela OpenAI.
