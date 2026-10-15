# Openfy v22 + v23 — Desktop Experience

- Ícone Pulse na barra superior e recursos do instalador.
- Botões anterior, reproduzir/pausar e próxima na prévia da barra de tarefas do Windows.
- Bandeja do sistema opcional, menu contextual, restauração e saída explícita.
- Notificações de faixa opcionais.
- Fade de volume configurável (0–6s) nas trocas e no play/pause. **Não é crossfade real**: não há duas músicas tocando simultaneamente.
- Mecanismo de áudio remoto preservado para evitar o bug de silêncio por CORS.

Testes: `npm install`, `npm run typecheck`, `npm run dev`. Testar bandeja e botões nativos no Windows.
