# Hotfix: streams online sem som

O equalizador Web Audio da v13 conectava o mesmo HTMLAudioElement utilizado para streams remotos. Uma vez conectado, o elemento continuava roteado pelo AudioContext mesmo quando a faixa era online; streams sem permissões CORS podem então produzir silêncio.

Este hotfix usa dois elementos independentes: um para arquivos locais (com EQ/analyser) e outro para streams online (reprodução direta). Também pausa o anterior na troca e reporta erros de play() em vez de ignorá-los.

Teste: local → online → local, controles de pausa, volume, seek, próxima faixa e equalizador local. O visualizador permanece zerado para streams remotos por enquanto. A execução no Electron Windows não foi validada aqui.
