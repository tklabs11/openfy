# Fontes de conteúdo e licenças

O Openfy não hospeda música. Ele consome APIs públicas e toca arquivos locais do usuário.
Este projeto não raspa plataformas proprietárias e não inclui ferramentas de download.

| Fonte | Uso no Openfy | Chave | Observações |
|-------|---------------|-------|-------------|
| Audius | Busca, tendências e stream completo | Não | Rede aberta. O app informa `app_name=Openfy`. Cada artista define as condições da própria faixa. |
| Jamendo | Busca, mais ouvidas e stream completo | `client_id` gratuito (opcional) | Faixas sob licenças Creative Commons; cada faixa tem a sua. Verifique antes de uso comercial. |
| Internet Archive | Busca e stream de áudio | Não | A busca filtra itens com licença Creative Commons (`LICENSE_FILTER` em `src/main/sources/archive.ts`). Itens de acesso restrito são ignorados. |
| Openverse | Busca de músicas com licença aberta | Não (acesso anônimo, com limite de uso) | Catálogo de mídia sob Creative Commons e domínio público; cada resultado informa a licença. O app só usa faixas da categoria música. Agrega fontes como Jamendo e Wikimedia Commons, então pode repetir faixas de outras fontes (o app remove duplicatas). |
| Arquivos locais | Reprodução de arquivos do próprio usuário | Não | Responsabilidade do usuário. |

O Openfy não toca YouTube, Deezer, Spotify nem outros serviços proprietários.

Antes de publicar, confirme os termos atuais de cada serviço. Termos mudam.

A licença de cada faixa (quando a fonte informa) é guardada no campo `license` da faixa, para exibição futura na interface.
