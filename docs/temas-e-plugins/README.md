# Guia de temas e plugins do Openfy

Este guia explica como personalizar a aparência do Openfy e como usar o Developer Mode para criar e compartilhar manifestos de plugins.

> **Importante:** nesta versão, temas são personalizáveis e podem ser importados/exportados. O Developer Mode não executa plugins de JavaScript: ele cria e guarda manifestos declarativos. Alguns efeitos de busca integrados ao app só são aplicados depois de ativar explicitamente um manifesto.

## Criar e compartilhar um tema

### Pelo editor do Openfy

1. Abra **Configurações → Aparência** e escolha **Personalizar temas**.
2. Na galeria, escolha um tema parecido com o resultado que deseja e clique em **Editar**.
3. Dê um nome ao tema. Ajuste cores, arredondamento, densidade, vidro, neon, fundo e animações.
4. Use **Aplicar prévia** para conferir as mudanças no app; **Cancelar** descarta a prévia e restaura o tema anterior.
5. Em **Salvar alterações em**, escolha o destino. Ao editar um tema personalizado, ele próprio vem selecionado para que **Salvar e aplicar** atualize o mesmo tema, sem criar cópias. Você também pode escolher outro tema personalizado ou **Criar um novo tema**. Temas oficiais nunca são sobrescritos: ao editá-los, o padrão é criar um tema personalizado.
6. Clique em **Exportar** no cartão para salvar o tema em JSON.

**Duplicar** cria uma cópia separada para experimentar sem alterar o original. Fundos escolhidos no dispositivo são guardados na pasta de dados do Openfy, com nome derivado do conteúdo. O arquivo JSON exportado não inclui a imagem local; ao exportar um tema com imagem personalizada, o JSON usa o fundo sólido para evitar uma referência quebrada em outro computador.

Na galeria, **Efeitos visuais avançados** desliga vidro, neon e fundos dinâmicos. **Modo leve** também reduz filtros e animações. O sistema operacional pode reduzir movimento automaticamente; a opção do tema e a extensão Calm Motion também respeitam essa preferência.

### Instalar um tema recebido

1. Abra **Configurações → Aparência → Personalizar temas**.
2. Clique em **Importar tema** e selecione o arquivo JSON.
3. O Openfy valida o arquivo e aplica o tema importado. Depois, ele aparece na galeria para ser aplicado, editado, exportado ou excluído.

Arquivos de tema devem ter até 25 KB. Ao importar, o Openfy gera um identificador local para o tema; o nome, autor, descrição e aparência são preservados.

### Formato de um tema

Um tema antigo continua válido com os campos obrigatórios abaixo. Os grupos `glass`, `neon`, `background` e `animations` são opcionais para compatibilidade; quando ausentes, recebem padrões neutros.

```json
{
  "id": "community-meu-tema",
  "name": "Meu tema",
  "author": "Seu nome",
  "description": "Uma descrição curta do visual.",
  "colors": {
    "bg": "#10131c",
    "panel": "#191f2b",
    "panel2": "#232c3b",
    "hover": "#303d50",
    "line": "#3b4960",
    "text": "#f4f6fb",
    "muted": "#aab5c7",
    "accent": "#70a5ff",
    "danger": "#ff6578"
  },
  "radius": 12,
  "density": "comfortable"
}
```

As cores controlam, respectivamente: fundo principal (`bg`), superfícies e painéis (`panel`, `panel2`), realce ao passar o mouse (`hover`), bordas (`line`), texto principal e secundário (`text`, `muted`), cor de destaque (`accent`) e cor de perigo (`danger`). `radius` aceita valores de 4 a 24 pixels. `density` pode ser `comfortable` ou `compact`; o modo compacto reduz o espaçamento de alguns elementos da interface.

Os campos opcionais disponíveis são:

- `glass`: `enabled`, `blur` (0–40), `opacity` (0–100), `border` (0–100) e `reflection`.
- `neon`: `enabled`, `color` (hexadecimal), `intensity` (0–100) e `elements` (`progress`, `controls`, `panels`, `active`).
- `background`: `mode` (`solid`, `custom`, `album`), `position` (`center`, `top`, `bottom`), `fit` (`cover`, `contain`), `blur` (0–40) e `dim` (0–85). `image` é uma referência local gerada pelo Openfy e não deve ser criada manualmente.
- `animations`: `transitions`, `pulse`, `intensity` (0–100) e `reduceMotion`.

O importador valida os campos, limites e valores hexadecimais, rejeita propriedades desconhecidas e não aceita CSS, JavaScript ou URLs de imagem arbitrárias. Imagens escolhidas pelo editor aceitam PNG, JPEG ou WebP de até 12 MB. Mantenha o arquivo JSON abaixo de 25 KB.

## Developer Mode: manifestos de plugins

### Criar, validar e compartilhar

1. Abra **Configurações → Desenvolvedor → Abrir Developer Mode**.
2. Edite o JSON no **Editor de manifesto**. O editor já abre com um exemplo válido.
3. Clique em **Validar** e corrija os erros indicados.
4. Clique em **Exportar JSON** para salvar o manifesto.
5. Compartilhe o arquivo `.openfy.json` com a comunidade. Quem o receber pode abrir o arquivo no Developer Mode, revisar as informações e permissões e então clicar em **Importar manifesto**.

Manifestos importados ficam listados em **Manifestos importados**. Nessa lista, é possível consultar as permissões declaradas, editar o manifesto ou removê-lo. Importar um manifesto com o mesmo `id` substitui o registro anterior após confirmação.

### Exemplo de manifesto

```json
{
  "schemaVersion": 1,
  "id": "comunidade.meu-plugin",
  "name": "Meu primeiro plugin",
  "version": "1.0.0",
  "author": "Seu nome",
  "description": "Uma breve descrição do que a extensão pretende fazer.",
  "kind": "utility",
  "permissions": ["player.read"]
}
```

Campos aceitos:

| Campo | Regras |
|---|---|
| `schemaVersion` | Deve ser o número `1`. |
| `id` | Obrigatório, até 100 caracteres; use letras minúsculas, números, pontos e hífens. Exemplo: `comunidade.meu-plugin`. |
| `name` | Obrigatório, até 80 caracteres. |
| `version` | Obrigatório, no formato SemVer, como `1.0.0` ou `1.0.0-beta.1`. |
| `author` | Obrigatório, até 80 caracteres. |
| `description` | Obrigatório, até 500 caracteres. |
| `kind` | Deve ser `integration`, `visualizer` ou `utility`. |
| `permissions` | Lista sem duplicatas contendo permissões reconhecidas: `library.read`, `player.read`, `theme.read`, `search.configure` e `sources.youtube`. Use `[]` se nenhuma for necessária. |
| `homepage` | Opcional; se informado, deve ser uma URL HTTPS. |
| `effects` | Opcional; efeitos suportados: `search.archive-license-filter` (`open-only` ou `off`, permissão `search.configure`) e `source.youtube` (`on`, permissão `sources.youtube`). Cada efeito precisa ser ativado pelo usuário. |

### Busca opcional do YouTube

O exemplo `plugins-exemplo/youtube.openfy.json` habilita a busca do YouTube quando importado e ativado. Para usá-la, configure sua própria chave da YouTube Data API v3 em **Configurações → Desenvolvedor**. A chave pertence ao usuário, fica criptografada pelo sistema operacional e as consultas consomem a cota do projeto Google Cloud correspondente. Os vídeos são reproduzidos somente no player oficial incorporado, visível no painel **Tocando agora**; o Openfy não extrai nem baixa áudio. A busca padrão continua sendo a do Internet Archive, filtrada para licenças abertas.

O arquivo aberto pelo botão **Abrir arquivo** deve ter até 64 KB.

### O que o Developer Mode faz nesta versão

O Developer Mode valida, importa, exporta e armazena os dados do manifesto neste dispositivo. Importar um manifesto **não** executa código externo nem concede acesso à biblioteca ou ao player. Os efeitos integrados são limitados aos tipos documentados neste guia e só são aplicados após ativação explícita; eles não instalam plugins executáveis nem ativam extensões no Mod Hub. Um catálogo de plugins da comunidade ainda não está disponível.

Não inclua senhas, tokens ou outros segredos em manifestos. Revise arquivos recebidos antes de importá-los e compartilhe apenas conteúdo sobre o qual você tenha direito.

## Compartilhar com a comunidade

Ao publicar um tema ou manifesto no Discord, inclua uma imagem ou descrição do resultado, a versão do Openfy usada e instruções úteis para quem for importar. Não compartilhe dados pessoais ou arquivos que não tenha autorização para distribuir.
