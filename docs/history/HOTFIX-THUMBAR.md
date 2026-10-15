# Openfy — Hotfix controles na prévia do Windows

Corrigido `setThumbarButtons`: ícones SVG gerados em memória foram substituídos por PNGs RGBA reais, evitando `NativeImage` vazio no Windows.

Os controles são reaplicados quando a janela aparece ou é restaurada, e atualizados conforme o estado Play/Pause.

Teste: `npm run dev`, passe o mouse sobre o ícone do Openfy na barra de tarefas (não na bandeja). Os três controles devem aparecer sob a miniatura.

Se não aparecerem, verifique mensagens `[Openfy]` no terminal do processo principal. Alguns ambientes Windows podem limitar esse recurso.
