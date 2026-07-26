<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.zh-HKTW.md">繁體中文</a> ·
  <a href="./README.hi.md">हिन्दी</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.fr.md">Français</a> ·
  <a href="./README.id.md">Bahasa Indonesia</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <strong>Português (Brasil)</strong> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.it.md">Italiano</a> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Dê ao site live do Claude um tema pessoal e reversível no Windows.</strong><br>
  Temas locais · Sem patch no Claude Desktop · Retornar ao visual original com um clique
</p>

<p align="center">
  <a href="#getting-started">Começar</a> ·
  <a href="#theme-showcase">Ver temas</a> ·
  <a href="#create-a-custom-theme">Criar tema</a> ·
  <a href="../docs/TROUBLESHOOTING.md">Solução de problemas</a> ·
  <a href="./SECURITY.md">Segurança</a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Escuro · Nova conversa · showcase de documentação fornecida por usuários</sub>
</p>

<p align="center"><sub>Pré-visualização de referência · não é fundo de tema importável nem evidência de aprovação ao vivo</sub></p>

> **Independent project.** O Claude Aura é um projeto independente e não é afiliado,
> endossado, patrocinado ou aprovado pela Anthropic PBC. Aura exibe o website live em
> `claude.ai`; não fornece o Claude nem modifica aplicativos instalados da Anthropic.
> Claude, Anthropic e nomes/marcas relacionados pertencem à Anthropic PBC.
> A licença do projeto não concede direitos sobre esses materiais.

<details>
<summary><strong>Public or commercial release trademark note</strong></summary>

> **Before public or commercial release:** Anthropic's current
> [Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
> require prior approval for its names and marks and prohibit altered marks. A
> disclaimer is not permission. A release that keeps the **Claude Aura** name
> or theme-styled Claude wordmarks needs written permission and appropriate
> legal review.

</details>

<a id="contents"></a>
<details>
<summary><strong>Conteúdo</strong></summary>

- [Claude Aura](#claude-aura)
  - [Por que Aura](#why-aura)
  - [Início rápido](#quick-start)
    - [Requisitos](#requirements)
    - [Instalação](#installation)
    - [Desinstalar](#uninstall)
  - [Destaque de temas](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Usar Aura](#use-aura)
  - [Criar tema personalizado](#create-a-custom-theme)
  - [Como o Aura funciona](#how-aura-works)
  - [Segurança e privacidade](#safety-and-privacy)
  - [Roteiro](#roadmap)
  - [Suporte e documentação](#support-and-documentation)
    - [Mapa de documentação](#documentation-map)
  - [Apoio solidário](#charitable-support)
  - [Licença e avisos](#license-and-notices)
  - [Agradecimentos](#acknowledgments)

</details>
<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Por que Aura

- **Use o site live do Claude.** O Aura mantém a interface real e os controles nativos,
em vez de substituí-los por uma tela reconstruída.
- **Deixe a mudança local e reversível.** Ele aplica estilização local sem fazer patch no
  Claude Desktop, e **Original look** remove a camada de apresentação do Aura em um clique.
- **Comece com oito temas integrados.** Cada um é um ponto inicial estável e somente leitura.
- **Crie temas sem sobrescrever os originais.** O Claude Aura Studio oferece cor local, tipografia,
  formas, efeitos e arte.

Aura 0.3 atualmente estiliza apenas o site live. Ainda não estiliza o Claude Desktop Code
nem o terminal do Claude Code, e o chat normal dentro do Aura não ganha acesso a projeto local.
Antes do lançamento final, o Aura Code precisa passar por uma prova de bloqueio de release com uma sessão
oficial de [Remote Control](https://code.claude.com/docs/en/remote-control) com tema em live
`claude.ai/code`; a exportação de terminal-theme equivalente cobre ambientes restritos sem patch no
Claude Desktop.

<details>
<summary><strong>Capacidades e exclusões completas</strong></summary>

Claude Aura abre o site real `claude.ai` em uma janela dedicada do Microsoft Edge WebView2
e aplica tema visual local. Ele é pensado para pessoas que querem workspace mais pessoal sem
fazer patch no Claude Desktop ou substituir a interface ativa por uma captura.

| O Aura faz | O Aura não faz |
| --- | --- |
| Carrega a interface live `claude.ai` em WebView2 | Substituir Claude por uma interface reconstruída |
| Aplica estilização local reversível | Fazer patch no Claude Desktop, `app.asar`, pacotes Windows ou assinaturas de código |
| Inclui oito temas integrados | Alterar contas, chats, chaves API, modelos ou configurações de provedor |
| Oferece Studio para temas personalizados locais | Se passar por produto oficial da Anthropic ou sistema de tema oficial |
| Oferece **Original look** no app | Apagar temas salvos ao desligar o estilo |

</details>

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>
<a id="getting-started"></a>
## Início rápido

<a id="requirements"></a>
### Requisitos

- Windows 10 ou Windows 11
- Acesso à internet e conta do Claude
- [Node.js 22 ou superior](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

O WebView2 está presente na maioria dos PCs Windows atuais. Se o Aura não conseguir abrir a janela do navegador,
instale ou repare o Evergreen WebView2 Runtime e tente novamente. Claude Desktop é opcional e permanece
separado.

<a id="installation"></a>
### Instalação

1. Baixe o
   [ZIP da release mais recente](https://github.com/erichuang1425/claude-aura/releases).
2. No File Explorer, clique com botão direito no ZIP e selecione **Extract All**.
3. Abra a pasta extraída e clique duas vezes em **Install Claude Aura.cmd**.
4. Aguarde o instalador encerrar e a janela **Claude Aura** abrir.
5. Faça login no Aura se `claude.ai` solicitar.
6. Clique no botão flutuante do Aura para abrir o Studio, depois escolha **Themes**.

A instalação não faz patch nem substitui o Claude Desktop.

<details>
<summary><strong>Comportamento do instalador, localização do app, checkouts de dev e desinstalação</strong></summary>

O instalador não elevado executa checagens embutidas, depois copia os arquivos do app para:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Cria atalhos de **Claude Aura** e **Claude Aura Studio** na Área de Trabalho e no menu Iniciar.
Configurações de tema e dados de login ficam em arquivos separados, então reinstalar o Aura não os substitui
silenciosamente.

Desenvolvedores podem clonar o repositório em vez de baixar ZIP e executar o mesmo instalador a partir do checkout.
O checkout roda a suíte de testes completa antes de instalar.

<a id="uninstall"></a>
### Desinstalar

Primeiro clique com botão direito no botão flutuante do Aura e escolha **Exit Claude Aura**.
Depois abra **Start > Claude Aura > Uninstall Claude Aura**, ou dê duplo clique em
**Uninstall Claude Aura.cmd** em uma release extraída. O desinstalador não continua enquanto o Aura estiver aberto.

Por padrão, a desinstalação remove a aplicação e atalhos do Aura, mas mantém a configuração local
de temas e o perfil de login WebView do Aura para reinstalação posterior. O desinstalador pergunta antes
de remover também essas pastas. Essa limpeza opcional remove a sessão de login local do Aura; nunca remove
Claude Desktop, a conta Anthropic do usuário ou dados de conta no servidor.

</details>
<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>

<a id="theme-showcase"></a>
## Destaque de temas

O sistema visual do Aura é demonstrado abaixo com referências de New chat e Conversation.
A pré-visualização em destaque de Japanese Film Editorial New chat está no topo deste README.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

<a id="japanese-film-editorial"></a>
### Japanese Film Editorial

Papel morno, tinta carvão, azul-índigo contido e vermelho-vermillion moderado.

<details>
<summary>Ver a visualização da Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>Escuro · Conversation · showcase de documentação fornecida por usuários</sub>
</p>

</details>

<a id="japanese-idol"></a>
### Japanese Idol

Creme morno, blush, rosa, lilás nacarado e detalhes finos de fita.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>Claro · Nova conversa · showcase de documentação fornecida por usuários</sub>
</p>

<details>
<summary>Ver a visualização da Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>Claro · Conversation · showcase de documentação fornecida por usuários</sub>
</p>

</details>

<a id="korean-idol"></a>
### Korean Idol

Branco frio, periwinkle, prata holográfica e vidro musical estruturado.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>Claro · Nova conversa · showcase de documentação fornecida por usuários</sub>
</p>

<details>
<summary>Ver a visualização da Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>Claro · Conversation · showcase de documentação fornecida por usuários</sub>
</p>

</details>

<details>
<summary><strong>Status de referência e limites de reutilização</strong></summary>

> **Status de referência:** estas imagens fornecidas por usuários comunicam a direção visual pretendida.
> Podem conter conteúdo ilustrativo de interface e não são evidência de aceitação ao vivo
> ou prova do comportamento atual de `claude.ai`. Não são fundos de tema, não devem ser importadas
> para o Aura e ficam fora dos instaladores de release.
>
> As prévias podem conter UI de produto de terceiros, nomes ou marcas, e arte de retrato com
> semelhança humana. Sua presença não concede direitos de reutilização. Confirme os direitos
> de interface, marca, arte e likeness antes de publicação ou redistribuição.

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>Todos os temas integrados e IDs estáveis</strong></summary>

O Aura oferece oito temas integrados em ordem estável:

| # | Theme | Stable ID |
| ---: | --- | --- |
| 1 | Default | `default` |
| 2 | Japanese Film Editorial | `japanese-film-editorial` |
| 3 | Korean Prestige | `korean-prestige` |
| 4 | Cartoon Studio | `cartoon-studio` |
| 5 | Anime Twilight | `anime-twilight` |
| 6 | Study Library | `study-library` |
| 7 | Japanese Idol | `japanese-idol` |
| 8 | Korean Idol | `korean-idol` |

Os integrados são somente leitura. O Studio cria uma cópia editável quando você deseja personalizar um tema.

</details>

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>
<a id="use-aura"></a>
## Usar Aura

| Ação | O que faz |
| --- | --- |
| Clique no botão flutuante do Aura | Abre o Claude Aura Studio |
| **Themes** | Abre a galeria integrada e salva o tema selecionado |
| **Create a theme** | Cria ou edita um tema personalizado pertencente ao Aura |
| **Personal wallpaper > Choose wallpaper*** | Seleciona uma imagem local separada do tema ativo |
| **Clear wallpaper** | Deixa de usar o papel de parede sem excluir o arquivo original |
| **Original look** | Remove a estilização do Aura e mostra o site live sem o tema selecionado |
| **Apply theme** | Restaura o tema Aura salvo após o Original look |
| **Open desktop app** | Abre o Claude Desktop sem modificá-lo |

O tema selecionado persiste entre reinícios do Aura. **Original look** desativa a camada de
apresentação do Aura; não apaga temas salvos nem arte personalizada. **Default** é o primeiro tema
ao
de Aura; não é o mesmo que Original look.

O lançador flutuante do Aura fica como um controle circular compacto. Clique para abrir Studio,
arraste para mover ou clique com o botão direito para o menu do Aura.

Personal wallpaper permanece vinculado ao caminho original da imagem. Mover ou remover esse arquivo
torna o papel de parede indisponível. A arte importada no editor segue outro caminho: o Studio
a cópia ou converte para pastas de tema próprias do Aura.

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>

<a id="create-a-custom-theme"></a>
## Criar tema personalizado

1. Abra o **Claude Aura Studio** pelo Desktop ou menu Iniciar.
2. Abra **Create a theme** e escolha **Customize Default** ou abra **Themes**,
   escolha um integrado e selecione **Duplicate to customize**.
3. Ajuste cores Light e Dark, tipografia, formas, efeitos e arte local.
4. Revise os layouts de New chat e Conversation na prévia do Studio.
5. Resolva avisos de contraste ou tamanho de arquivo.
6. Escolha **Save theme**.

Arquivos integrados nunca são sobrescritos. Se um rascunho ficar inválido, ele continua editável
enquanto o Aura segue exibindo a última versão válida.

Imagens PNG, JPEG, WebP ou AVIF importadas são convertidas localmente em assets WebP com
limites. O Studio não armazena o caminho fonte dentro do tema. Para o editor completo e o contrato
de tema, consulte a [Theme Kit Specification](../docs/THEME_KIT_SPEC.md).

Quando disponível, o Studio pode usar uma captura da janela real do Aura como plano de fundo de edição.
Essa captura pode incluir conteúdo de conversa, fica na memória apenas da sessão atual e nunca é gravada em disco.

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>

<a id="built-with"></a>
<a id="how-aura-works"></a>
## Como o Aura funciona

| Parte | Função |
| --- | --- |
| Windows PowerShell e WinForms | Instalador, janela do Aura, Studio, atalhos e controles locais |
| Microsoft Edge WebView2 | Exibe o site real `claude.ai` |
| Node.js 22+ | Valida temas e constrói o estilo local |
| HTML, CSS, JavaScript, SVG e WebP locais | Fornecem estilização do Aura e ativos dos temas integrados |

O projeto não tem dependências npm nem fontes de runtime externas.

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>

<a id="safety-and-privacy"></a>
## Segurança e privacidade

- Aura carrega o site HTTPS live `claude.ai` no Microsoft Edge WebView2.
- Páginas do provedor de login não são estilizadas.
- Aura não abre porta de remote-debugging nem faz patch no Claude Desktop.
- Arquivos de tema e arte importada ficam em pastas locais do Aura.
- A página live continua conectada normalmente à Anthropic.
- O perfil WebView contém dados de sessão de login e deve ser protegido.
- Capturas live-page do Studio permanecem na memória apenas durante a sessão de edição
  e não são salvas em disco.
- Não selecione imagem de fundo sensível; a página live pode acessar tecnicamente dados
  DOM dentro do seu próprio processo.
- O uso do serviço live segue os atuais [Consumer Terms](https://www.anthropic.com/terms)
  e [Usage Policy](https://www.anthropic.com/legal/aup) da Anthropic.

Leia [SECURITY.md](./SECURITY.md) para o limite de confiança e
[Troubleshooting](../docs/TROUBLESHOOTING.md) para login, carregamento, tema, imagem e WebView2.

<a id="local-data"></a>
<details>
<summary><strong>Pastas de dados locais e retenção na desinstalação</strong></summary>

Aura separa application, settings, themes, drafts e perfil do navegador:

| Path | Contents |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Aplicação do Aura instalada |
| `%LOCALAPPDATA%\ClaudeAura\data` | Configurações, logs e estado local do Aura |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Temas personalizados salvos e arte derivada |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Rascunhos em andamento do Studio |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Perfil de login WebView2 separado do Aura |

Trate `webview` como qualquer perfil de navegador com login. Não publique nem compartilhe.
A desinstalação padrão mantém `data` e `webview`; escolha a remoção explícita apenas se também quiser apagar
configurações locais, temas e o perfil de login separado.

</details>

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>
<a id="roadmap"></a>
## Roteiro

- [x] Companion Windows WebView2 dedicado e **Original look** reversível
- [x] Oito temas integrados estáveis com suporte a Light e Dark
- [ ] Concluir e revisar o editor visual no-code do Studio
- [ ] Concluir e aprovar o Aura Code para Claude Code Remote Control local oficial com export terminal-theme correspondente
- [ ] Publicar tutorial de tema personalizado de 30 minutos
- [ ] Executar a varredura final de verificação da release

Veja o
[relatório de implementação](../docs/IMPLEMENTATION_REPORT.md) e
[issues do repositório](https://github.com/erichuang1425/claude-aura/issues)
para status público. Uma pré-visualização de referência não substitui a evidência de aceitação live do Aura.

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>

<a id="support"></a>
## Suporte e documentação

Comece por [Troubleshooting](../docs/TROUBLESHOOTING.md). Para um bug reproduzível
ou solicitação de recurso, use a [página de Issues](https://github.com/erichuang1425/claude-aura/issues).

Ao reportar um bug, inclua versões de Windows, Node.js e WebView2, o ID do tema ativo e os passos para reproduzir.
Revise os logs antes de compartilhá-los; o log da UI do Aura fica em:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Reportar problemas de segurança via advisory privado de segurança do repositório, como descrito em
[SECURITY.md](./SECURITY.md).

<a id="documentation-map"></a>
### Mapa de documentação

- [Troubleshooting](../docs/TROUBLESHOOTING.md)
- [Security and trust boundary](./SECURITY.md)
- [Theming guide](../docs/THEMING.md)
- [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)
- [Implementation report](../docs/IMPLEMENTATION_REPORT.md)
- [File Manifest](../docs/FILE_MANIFEST.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Repository issues](https://github.com/erichuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>Verificações e limites do projeto</strong></summary>

Execute verificações obrigatórias antes de enviar mudanças:

```powershell
npm run check
npm run verify:cycle
```

Para um único auditório de tema integrado:

```powershell
node scripts/theme-cli.mjs qa <id>
```

Mantenha estes limites do projeto:

- Não adicione dependências npm ou fontes de runtime.
- Mantenha IDs de tema e ordem estáveis.
- Não distribua HTML de interface reconstruído do Claude como conteúdo do produto.
- Não apresente imagens de referência como evidência de aceitação de UI.
- Inclua origem, licença e distribuição para mídias contribuidas.

Consulte [CONTRIBUTING.md](./CONTRIBUTING.md), o [Theming guide](../docs/THEMING.md),
a [Theme Kit Specification](../docs/THEME_KIT_SPEC.md) e [File Manifest](../docs/FILE_MANIFEST.md)
antes de alterar o sistema de temas ou a árvore de release.

</details>

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>

<a id="charitable-support"></a>
## Apoio solidário

Claude Aura não aceita doações pessoais, gorjetas, patrocínios, pagamentos por indicação
ou outro apoio financeiro. O proprietário está atualmente sob
[Student route conditions](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student)
em condições no Reino Unido, que proíbem autoemprego ou atividade empresarial,
exceto em circunstâncias limitadas.
Para evitar qualquer conflito com essas condições, o proprietário não pode aceitar doações
de projeto ou gorjetas vinculadas enquanto elas se aplicarem.

<details>
<summary><strong>Contexto de Student-route, nonprofits independentes e limites de doação</strong></summary>

Leitores que desejam apoiar trabalho de interesse público podem doar diretamente a uma das organizações sem fins lucrativos:

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  ajuda pessoas afetadas por conflitos e desastres, inclusive refugiados reconstruindo a vida no Reino Unido.
  O International Rescue Committee maior também participa do
  [Claude Corps](https://www.anthropic.com/news/claude-corps).
- [CodePath](https://www.every.org/codepath) oferece educação técnica gratuita
  e trabalha com a Anthropic como parceiro nonprofit para
  [Claude Corps](https://www.anthropic.com/news/claude-corps).

Esses links levam diretamente a terceiros. O Claude Aura e seu proprietário não coletam,
processam, controlam, recebem ou se beneficiam financeiramente de qualquer doação.
As organizações gerenciam o processamento e recibos de doações. A presença delas não implica
qualquer afiliação, patrocínio, aprovação ou parceria oficial de arrecadação com o Claude Aura.

</details>

<a id="license-and-notices"></a>
## Licença e avisos

O software do projeto é distribuído sob a [MIT License](./LICENSE).
Consulte também [NOTICE.md](./NOTICE.md) e [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

A MIT License não concede direitos sobre nomes, marcas, interface, site ou aplicações da Anthropic.
Legendas de showcase não concedem direitos de reutilização de UI exibida, arte, nomes,
marcas ou semelhança humana. Avisos de direitos e fontes específicos por arquivo continuam válidos.

Verifique as atuais [Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
e [Consumer Terms](https://www.anthropic.com/terms). Obtenha permissão necessária antes de publicar,
modificar ou redistribuir nomes, marcas, capturas de interface, arte ou semelhanças reconhecíveis protegidas.
Este repositório e README não concedem essa permissão.

<a id="acknowledgments"></a>
## Agradecimentos

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) influenciou o fluxo de validação
  loopback original e o padrão de showcase acessível.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin)
  influenciou o mapeamento semântico inicial de tema.
- [Best README Template](https://github.com/othneildrew/Best-README-Template)
  influenciou a estrutura orientada ao leitor deste README.
- Microsoft Edge WebView2 fornece o runtime do navegador incorporado.

Licenças detalhadas e provenance estão registradas em
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). Acknowledgment não significa
afiliação, patrocínio ou aprovação.

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>
