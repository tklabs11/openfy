# Fontes de conteúdo e licenças

O Openfy não hospeda música. Ele consome APIs públicas e toca arquivos locais do usuário.
Este projeto não raspa plataformas proprietárias e não inclui ferramentas de download.

| Fonte | Uso no Openfy | Chave | Observações |
|-------|---------------|-------|-------------|
| Internet Archive | Busca e stream de áudio (padrão) | Não | Por padrão, a busca limita resultados a licenças abertas. O filtro pode ser alterado por um efeito de manifesto ativado explicitamente. Itens de acesso restrito são ignorados. |
| YouTube | Busca opcional e reprodução pelo player oficial incorporado | Chave própria da YouTube Data API v3 | Desativado por padrão; exige importar e ativar um manifesto com o efeito `source.youtube`. A chave é armazenada criptografada pelo sistema operacional. A busca consome cota do projeto Google Cloud do usuário. O Openfy não extrai nem baixa áudio. Cada vídeo continua sujeito aos termos e direitos definidos pelo YouTube e pelos titulares. |
| Arquivos locais | Reprodução de arquivos do próprio usuário | Não | Responsabilidade do usuário. |

Audius, Jamendo, Openverse e LibriVox têm módulos de fonte preservados no código, mas não são consultados pela busca online ativa desta versão.

O Openfy não integra Deezer, Spotify nem outros serviços proprietários. O uso do player oficial do YouTube não implica afiliação ou endosso pelo YouTube ou pelo Google.

Antes de publicar, confirme os termos atuais de cada serviço. Termos mudam.

A licença de cada faixa (quando a fonte informa) é guardada no campo `license` da faixa, para exibição futura na interface.
