# Openfy — Correção de cache e instância única

- Define `sessionData` em `%LOCALAPPDATA%\Openfy\ChromiumCache` antes de inicializar o Electron, quando possível.
- Mantém o `userData` original, preservando biblioteca, playlists e preferências.
- Impede uma segunda instância do Openfy e restaura a janela existente.
- Se o caminho de cache não puder ser criado, mantém o caminho padrão e registra aviso.

## Testes no Windows

1. Feche o Openfy por **Sair** na bandeja e execute `npm run dev`.
2. Confirme se a música e as preferências permanecem salvas.
3. Abra outra instância e confira se a primeira janela é restaurada.
4. Teste minimizar para bandeja, reprodução online e controles da barra de tarefas.

Os avisos de acesso negado podem persistir em máquinas com antivírus, permissões especiais ou perfis corrompidos. Nesse caso, investigue o ambiente sem apagar dados permanentes.
