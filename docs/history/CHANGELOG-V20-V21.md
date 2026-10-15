# Openfy v20 + v21 — Your Music, Your World

- Identidade Pulse em `resources/openfy-pulse.png` e `.ico` para empacotamento.
- Última fila, faixa, posição, volume, repetição e shuffle persistidos localmente; reprodução inicia **pausada**.
- Recomendações locais baseadas em artistas ouvidos, reproduções completas e faixas curtidas, sem anúncios ou conta.
- Configurações > Privacidade: opção de desativar a coleta e apagar o histórico, com a frase escolhida para o projeto.

**Limitações:** recomendação inicial usa faixas conhecidas no catálogo local/featured; não é um motor de busca remoto personalizado. URLs online expiradas ou arquivos locais removidos podem não restaurar. Áudio online mantém fallback direto do hotfix anterior; equalizador CORS permanece limitado. Testar no Windows com `npm run typecheck` e `npm run dev`.
