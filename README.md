# Openfy

Player de música desktop (Electron + React + TypeScript), código aberto (MIT), visual inspirado em apps de streaming.

## Fontes de música
- **Internet Archive**: fonte padrão da busca online, sem chave. Usa a mesma busca do site do Archive (ordenação por relevância). O filtro "só licenças abertas" fica em **Configurações → Busca** e vem desligado.
- **YouTube**: ativado por padrão. Busca em instâncias públicas do Invidious, sem chave de API, e reproduz vídeos no player oficial incorporado; o Openfy não extrai nem baixa áudio. Pode ser desativado em **Configurações → Desenvolvedor**.
- **Arquivos locais**: mp3, flac, wav, ogg, m4a, aac, opus via "Músicas salvas".

A busca roda dentro do app (processo principal); não existe servidor. Veja `docs/LICENSES.md`.

## YouTube
A busca do YouTube já vem ativada e não exige chave: o Openfy consulta instâncias públicas do [Invidious](https://invidious.io) e, se uma estiver fora do ar ou limitando acesso, tenta outra automaticamente. Como as instâncias são mantidas pela comunidade, a busca pode falhar temporariamente; use **Testar busca** em **Configurações → Desenvolvedor** para diagnosticar. Para desativar, use o mesmo painel — as pesquisas passam a trazer apenas o Internet Archive. O manifesto fica em `plugins-exemplo/youtube.openfy.json` para quem quiser reimportar.

## Rodar
Veja `COMO-USAR.txt` (Windows: dois cliques em `INSTALAR-E-RODAR.bat`). Ou:
```bash
npm ci
npm run dev        # desenvolvimento
npm run dist       # instalador da plataforma atual em dist/
npm run dist:win   # instalador NSIS para Windows
npm run dist:linux # AppImage, .deb, .rpm e .tar.gz para Linux
```

## Instalar no Linux

Cada release publica quatro formatos:

| Distros | Arquivo | Instalação |
|---|---|---|
| Debian, Ubuntu, Mint, Pop!_OS | `openfy_<versão>_amd64.deb` | `sudo apt install ./openfy_<versão>_amd64.deb` |
| Fedora, openSUSE, RHEL | `openfy-<versão>.x86_64.rpm` | `sudo dnf install ./openfy-<versão>.x86_64.rpm` |
| Qualquer distro (portátil) | `openfy-<versão>.tar.gz` | extraia e rode `./openfy` |
| Qualquer distro (portátil) | `Openfy-<versão>.AppImage` | `chmod +x` e execute |

Com `.deb` ou `.rpm`, abra pelo menu de aplicativos (ou rode `/opt/Openfy/openfy`).

O AppImage precisa do FUSE 2 (`libfuse2` no Debian/Ubuntu, `fuse-libs` no Fedora, `fuse2` no Arch); sem ele, rode com `--appimage-extract-and-run`. O `.tar.gz` não depende de FUSE.

No Ubuntu 23.10 e mais recente o AppArmor restringe user namespaces para aplicativos abertos pela sessão gráfica. O `.deb` configura o helper SUID do Chromium na instalação, e o AppImage detecta a restrição e inicia com `--no-sandbox` automaticamente. No Ubuntu, prefira o `.deb`.

Atualização automática: no Linux funciona pelo AppImage; nos pacotes `.deb`/`.rpm`, atualize pelo gerenciador. Teclas de mídia e o painel de mídia do GNOME/KDE funcionam via MPRIS. A bandeja depende do ambiente gráfico (no GNOME pode exigir a extensão AppIndicator).

## Android (primeira versão)

A versão Android usa [Capacitor](https://capacitorjs.com) e reaproveita a interface React. No celular a navegação vira abas — **Início**, **Buscar** e **Biblioteca** —, com mini-player fixo acima da barra e player em tela cheia ao tocar na faixa.

Áudio e controles:
- Faixas de áudio (ex.: Internet Archive) continuam tocando em segundo plano. Um serviço em primeiro plano mantém o app vivo e uma `MediaSession` nativa alimenta a notificação, a tela de bloqueio e os botões do fone, com play, pausar, anterior, próxima e seek.
- Vídeos do YouTube pausam quando a página fica oculta — limitação do player oficial. Para não interromper a música, ao sair do app a faixa passa a tocar pelo stream só de áudio do Invidious e volta para o vídeo na posição certa quando o app reaparece: **sem nenhuma janela na frente dos outros aplicativos**. Quem preferir o vídeo visível pode ligar **Configurações → Segundo plano → Vídeo em janela flutuante**, ou usar o botão de janela flutuante no player.

Este primeiro corte cobre busca online (Internet Archive e YouTube via Invidious), reprodução, biblioteca, favoritos e playlists. Arquivos locais e integrações de desktop (bandeja, Discord) ainda não estão disponíveis.

Atualizações:
- O APK sai na mesma pré-release do GitHub que os instaladores de Windows e Linux. Em **Configurações → Atualizações**, o app consulta a release, baixa o APK novo e abre o instalador do sistema — na primeira vez o Android pede para permitir "instalar apps desconhecidos" para o Openfy.
- No CI o APK é assinado quando existem os secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`; sem eles é publicado o APK de debug (assinatura diferente a cada build exige desinstalar antes de atualizar).

```bash
npm ci
npm run build:android   # gera a interface em out/android
npm run cap:sync        # copia a interface para android/
npm run cap:open        # abre o projeto no Android Studio
npm run android:apk     # gera o APK de debug
```

Para gerar o APK é preciso JDK 21 e o Android SDK (o Android Studio instala os dois). A biblioteca fica no armazenamento do próprio WebView do app; não há servidor.

## Estrutura
```
src/main/sources  Internet Archive e integração opcional com YouTube
src/main          janela, IPC, protocolo para arquivos locais, salvamento
src/preload       ponte segura
src/shared        tipos e config (JAMENDO_CLIENT_ID)
src/renderer      interface React (views, componentes, player, biblioteca)
```

## Atalhos
Espaço = play/pause. Teclas de mídia do teclado funcionam; no Linux elas chegam pelo MPRIS, e o Openfy também aparece no controle de mídia do GNOME, KDE e afins.

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

Para publicar uma versão beta, crie uma tag `v` igual à versão do `package.json` (por exemplo, `v0.2.0-beta.5`) e envie-a ao GitHub. O workflow gera o instalador NSIS no Windows e, em seguida, AppImage, `.deb`, `.rpm` e `.tar.gz` no Linux, publicando tudo na mesma pré-release com os metadados necessários para o atualizador. A configuração atual está no canal beta; antes da primeira versão estável, altere `build.publish.releaseType` para `release`.

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
