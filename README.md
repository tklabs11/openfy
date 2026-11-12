# Openfy

Player de música desktop (Electron + React + TypeScript), código aberto (MIT), visual inspirado em apps de streaming.

## Fontes de música
- **Internet Archive**: fonte padrão da busca online, sem chave; por padrão, mostra resultados com licenças abertas.
- **YouTube (opcional)**: pode ser ativado por manifesto no Developer Mode. Busca em instâncias públicas do Invidious, sem chave de API, e reproduz vídeos no player oficial incorporado; o Openfy não extrai nem baixa áudio.
- **Arquivos locais**: mp3, flac, wav, ogg, m4a, aac, opus via "Músicas salvas".

A busca roda dentro do app (processo principal); não existe servidor. O YouTube não participa até que o usuário importe e ative um manifesto em **Configurações → Desenvolvedor**. Veja `docs/LICENSES.md`.

## YouTube opcional
Para habilitar a busca do YouTube, importe e ative `plugins-exemplo/youtube.openfy.json` em **Configurações → Desenvolvedor**. Não é preciso criar chave: o Openfy consulta instâncias públicas do [Invidious](https://invidious.io) e, se uma estiver fora do ar ou limitando acesso, tenta outra automaticamente. Como as instâncias são mantidas pela comunidade, a busca pode falhar temporariamente; use **Testar busca** em **Configurações → Desenvolvedor** para diagnosticar. A busca padrão continua sendo a do Internet Archive.

## Rodar
Veja `COMO-USAR.txt` (Windows: dois cliques em `INSTALAR-E-RODAR.bat`). Ou:
```bash
npm ci
npm run dev        # desenvolvimento
npm run dist       # instalador da plataforma atual em dist/
npm run dist:win   # instalador NSIS para Windows
npm run dist:linux # AppImage e .deb para Linux
```

## Instalar no Linux

Cada release publica `Openfy-<versão>.AppImage` e `openfy_<versão>_amd64.deb`:

```bash
chmod +x Openfy-0.2.0-beta.2.AppImage
./Openfy-0.2.0-beta.2.AppImage
```

```bash
sudo apt install ./openfy_0.2.0-beta.2_amd64.deb
```

Depois abra pelo menu de aplicativos (ou rode `/opt/Openfy/openfy`).

No Ubuntu 22.04 e mais recente o AppImage precisa do FUSE 2 (`sudo apt install libfuse2`; no 24.04+ o pacote se chama `libfuse2t64`). Sem ele, rode com `--appimage-extract-and-run`.

No Ubuntu 23.10 e mais recente o AppArmor restringe user namespaces para aplicativos abertos pela sessão gráfica. O pacote `.deb` configura o helper SUID do Chromium na instalação e funciona normalmente — no Ubuntu, prefira o `.deb`. O AppImage não consegue usar esse helper (o FUSE monta a imagem sem SUID), então, se ele for aberto direto pelo arquivo, rode `./Openfy-*.AppImage --no-sandbox`; integrado ao menu, o atalho gerado já inclui essa opção.

No Linux, a atualização automática funciona pelo AppImage; no `.deb`, atualize com `apt`. A bandeja depende do ambiente gráfico (no GNOME pode exigir a extensão AppIndicator) e as teclas de mídia podem ser bloqueadas pelo Wayland.

## Estrutura
```
src/main/sources  Internet Archive e integração opcional com YouTube
src/main          janela, IPC, protocolo para arquivos locais, salvamento
src/preload       ponte segura
src/shared        tipos e config (JAMENDO_CLIENT_ID)
src/renderer      interface React (views, componentes, player, biblioteca)
```

## Atalhos
Espaço = play/pause. Teclas de mídia do teclado funcionam.

## Discord Rich Presence

Ative em **Configurações → Desktop → Discord Rich Presence** para mostrar no Discord a faixa e o artista reproduzidos no Openfy. O Discord precisa estar aberto, e a exibição da atividade depende das configurações de privacidade do próprio Discord. A integração fica desativada por padrão.

## Comunidade

Entre no [Discord oficial da TK Labs](https://discord.gg/HWgXKfhXAW) para acompanhar o Openfy, trocar ideias e compartilhar sugestões.

## Personalização visual — Theme Engine 2.0

Personalize cores, arredondamento e densidade, combine painéis de vidro e iluminação neon, escolha um fundo sólido, uma imagem local ou a capa da faixa e ajuste as animações. A prévia do editor é atualizada em tempo real. Os presets **Openfy Glass**, **Openfy Neon Pulse** e **Openfy Ambient** demonstram diferentes combinações de efeitos.

Ao editar um tema personalizado, é possível salvar as mudanças nele mesmo ou escolher outro tema personalizado como destino; temas oficiais não são sobrescritos. Também é possível criar uma nova cópia, duplicar e importar ou exportar temas. **Efeitos visuais avançados** e **Modo leve** permitem desligar ou reduzir os efeitos. Consulte o [guia de temas e plugins](docs/temas-e-plugins/README.md) para detalhes e compatibilidade.

## Temas e plugins da comunidade

Crie e compartilhe temas personalizados e conheça os limites atuais do Developer Mode no [guia de temas e plugins](docs/temas-e-plugins/README.md). Manifestos são declarativos e não executam código externo; efeitos de busca suportados só entram em vigor após ativação explícita.

## Atualizações automáticas (Windows e AppImage no Linux)

As versões instaladas no Windows e o AppImage do Linux verificam atualizações publicadas em GitHub Releases. A verificação também pode ser iniciada em **Configurações → Desktop**; quando uma atualização é encontrada, o app a baixa e oferece reiniciar para instalar. Versões beta recebem versões beta e estáveis recebem apenas versões estáveis. O `.deb` não usa o atualizador do app: atualize com o gerenciador de pacotes.

Para publicar uma versão beta, crie uma tag `v` igual à versão do `package.json` (por exemplo, `v0.2.0-beta.2`) e envie-a ao GitHub. O workflow gera o instalador NSIS no Windows e, em seguida, AppImage e `.deb` no Linux, publicando tudo na mesma pré-release com os metadados necessários para o atualizador. A configuração atual está no canal beta; antes da primeira versão estável, altere `build.publish.releaseType` para `release`.

## Fila e backup da biblioteca

Use **Tocar a seguir** no menu de uma faixa para colocá-la depois da música atual. Na fila de reprodução, é possível remover faixas, arrastá-las para reorganizar e limpar as próximas músicas sem interromper a faixa atual.

Em **Configurações → Geral**, exporte ou importe um backup JSON da biblioteca. A importação mescla músicas salvas, favoritos e playlists sem apagar os dados atuais. Backups podem conter caminhos de arquivos locais e capas personalizadas; armazene-os em local privado. O backup guarda os dados da biblioteca, não copia os arquivos de áudio locais.

Em **Configurações → Geral**, também é possível ativar a busca opcional de capas para músicas locais adicionadas. O Openfy procura pelo título e artista no catálogo do iTunes; esses nomes são enviados à Apple. A capa pode ser escolhida ou substituída em **Mais ações → Detalhes da faixa**. O recurso vem desativado por padrão.

## Painel da faixa e ações

Com uma faixa em reprodução, use o botão de painel no topo para recolher ou expandir a área **Tocando agora**. As abas mostram a capa, a fila, informações da faixa e letras quando disponíveis. As letras são consultadas no LRCLIB somente ao abrir a aba **Letra**; nesse momento, título e artista são enviados ao serviço para localizar o conteúdo. Os resultados são armazenados em memória e as consultas são espaçadas; se o LRCLIB limitar o acesso, o painel informa quanto aguardar antes de tentar novamente.

Clique com o botão direito em uma faixa ou use **Mais ações** para colocá-la a seguir, adicioná-la a uma playlist, salvá-la, copiar o link da fonte ou ver os detalhes. Faixas locais não têm link compartilhável.

## Verificações

Execute `npm test` para os testes unitários focados em fila de reprodução, letras, mesclagem/validação de backups e tratamento de falha parcial das fontes. `npm run typecheck` valida os tipos da aplicação.

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

- **TK** — criador do Openfy.
- **TK Labs** — desenvolvimento.
- **ChatGPT (OpenAI)** — assistência de IA no desenvolvimento, depuração, documentação e organização do projeto.
- **Comunidade Openfy** — futuras contribuições de código, temas, plugins e documentação.

O Openfy é um projeto independente, não afiliado nem endossado pela OpenAI.
