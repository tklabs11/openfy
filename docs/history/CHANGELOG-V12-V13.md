# Openfy v12 + v13 — Music Experience

## v12 Music Discovery
- Nova navegação Descobrir com gêneros e consulta às fontes já integradas.
- Openfy Radio: gera fila de reprodução com resultados do gênero e termo opcional.
- Favoritas e histórico recente local (histórico é atualizado ao tocar uma faixa).
- Nenhum serviço novo nem credenciais extras necessários.

## v13 Audio Studio
- Equalizador 10 bandas com presets Flat, Bass, Eletrônica, Rock e Vocal.
- Persistência local dos ganhos do equalizador.
- Visualizador de espectro e opção de desativação.
- Mini player flutuante dentro da janela principal, com controles.

## Limitações conhecidas
- Efeitos Web Audio (EQ e espectro) somente em arquivos locais: streams externos continuam no caminho de áudio padrão para evitar bloqueio por CORS.
- Rádio é uma fila automática baseada na busca, não um algoritmo de recomendação personalizado.
- Mini player não é uma janela independente do Electron.
- Não foi possível executar Electron ou validar a compilação completa neste ambiente.

## Como testar
1. Extraia o ZIP em uma pasta nova (faça backup dos seus dados).
2. Execute `npm install` e `npm run dev`.
3. Verifique Descobrir, rádio, Audio Studio e as funcionalidades anteriores.
4. Para validar o equalizador, importe uma música local e dê play.
