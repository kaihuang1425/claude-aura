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
  <a href="./README.pt-BR.md">Português (Brasil)</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <strong>Italiano</strong> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Dai al sito live di Claude un tema personale e reversibile su Windows.</strong><br>
  Temi locali · Nessuna patch a Claude Desktop · Torna all'aspetto originale con un clic
</p>

<p align="center">
  <a href="#getting-started">Guida rapida</a> ·
  <a href="#theme-showcase">Vedi i temi</a> ·
  <a href="#create-a-custom-theme">Crea un tema</a> ·
  <a href="../docs/TROUBLESHOOTING.md">Risoluzione problemi</a> ·
  <a href="./SECURITY.md">Sicurezza</a>
</p>

<p align="center">
  <a href="https://github.com/kaihuang1425/claude-aura"><strong>Se Claude Aura ti è utile, lascia una stella al progetto su GitHub.</strong></a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Scuro · Nuova chat · showcase documentazione fornita dagli utenti</sub>
</p>

<p align="center"><sub>Anteprima di riferimento · non è uno sfondo tema importabile né prova di accettazione live</sub></p>

> **Independent project.** Claude Aura è un progetto indipendente e non è affiliato, approvato,
sponsorizzato o supportato da Anthropic PBC. Aura mostra il sito live su `claude.ai`;
non fornisce Claude né modifica applicazioni installate di Anthropic. Claude, Anthropic e i nomi/marchi associati
appartengono a Anthropic PBC. La licenza del progetto non concede diritti su quel materiale.

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
<summary><strong>Indice</strong></summary>

- [Claude Aura](#claude-aura)
  - [Perché Aura](#why-aura)
  - [Guida rapida](#quick-start)
    - [Requisiti](#requirements)
    - [Installazione](#installation)
    - [Disinstallazione](#uninstall)
  - [Vetrina temi](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Usa Aura](#use-aura)
  - [Crea un tema personalizzato](#create-a-custom-theme)
  - [Come funziona Aura](#how-aura-works)
  - [Sicurezza e privacy](#safety-and-privacy)
  - [Roadmap](#roadmap)
  - [Supporto e documentazione](#support-and-documentation)
    - [Mappa documentazione](#documentation-map)
  - [Supporto benefico](#charitable-support)
  - [Licenza e note](#license-and-notices)
  - [Ringraziamenti](#acknowledgments)

</details>
<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Perché Aura

- **Usa il sito live di Claude.** Aura mantiene l’interfaccia reale e i controlli nativi,
invece di sostituirli con una schermata ricostruita.
- **Mantieni i cambiamenti locali e reversibili.** Applica stili locali senza patchare Claude Desktop,
e **Original look** rimuove la presentazione di Aura con un clic.
- **Inizia con otto temi integrati.** Ciascuno è un punto di partenza stabile in sola lettura.
- **Crea temi senza sovrascrivere quelli originali.** Claude Aura Studio supporta colori locali, tipografia, forme, effetti e artwork.

Aura 0.3 temizza solo il sito live al momento. Non applica ancora un tema a native Claude Desktop Code o al terminale Claude Code,
e la chat normale in Aura non ottiene accesso ai progetti locali. Prima del rilascio finale,
Aura Code deve superare un proof-of-blocking di release con una sessione ufficiale di
[Remote Control](https://code.claude.com/docs/en/remote-control) themed su live `claude.ai/code`;
l’export terminal-theme corrispondente copre ambienti restrittivi senza patchare Claude Desktop.

<details>
<summary><strong>Funzioni e esclusioni complete</strong></summary>

Claude Aura apre il sito reale `claude.ai` in una finestra dedicata di Microsoft Edge
WebView2 e applica un tema visivo locale. È pensato per chi desidera uno spazio più personale
senza patchare Claude Desktop o sostituire l’interfaccia live con uno screenshot.

| Cosa fa Aura | Cosa non fa Aura |
| --- | --- |
| Carica l’interfaccia live `claude.ai` in WebView2 | Sostituisce Claude con un’interfaccia ricostruita |
| Applica uno styling locale reversibile | Patcha Claude Desktop, `app.asar`, pacchetti Windows o firme di codice |
| Fornisce otto temi integrati | Cambia account, chat, API key, modelli o impostazioni provider |
| Fornisce Studio per temi personalizzati locali | Si presenta come prodotto ufficiale Anthropic o sistema tema ufficiale |
| Offre **Original look** nell’app | Cancella temi salvati quando lo stile è disattivato |

</details>

<p align="right">(<a href="#readme-top">torna su</a>)</p>
<a id="getting-started"></a>
## Guida rapida

<a id="requirements"></a>
### Requisiti

- Windows 10 o Windows 11
- Accesso a internet e account Claude
- [Node.js 22 o superiore](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 è presente sulla maggior parte dei PC Windows moderni. Se Aura non riesce ad aprire la finestra del browser,
installa o ripara Evergreen WebView2 Runtime e riprova. Claude Desktop è opzionale e resta separato.

<a id="installation"></a>
### Installazione

Apri l'[ultima release](https://github.com/kaihuang1425/claude-aura/releases) e scegli uno di questi percorsi. Entrambi installano la stessa versione per l'account Windows corrente.

| Percorso | Usalo quando | Scarica |
| --- | --- | --- |
| **Unsigned Setup** | Vuoi l'installatore guidato più semplice e Windows lo apre normalmente | `Claude-Aura-Setup-v<version>-UNSIGNED.exe` con relativo `.sha256` e `.manifest.json` |
| **ZIP + CMD fallback** | Windows avvisa o blocca l'Unsigned Setup, oppure preferisci script sorgente leggibili | `claude-aura-v<version>.zip` con relativo `.sha256` |

#### Percorso 1 ??Unsigned Setup

1. In **Assets**, scarica `-UNSIGNED.exe`, il relativo `.sha256` e il relativo `.manifest.json`. Non usare gli archivi **Source code** generati automaticamente da GitHub.
2. Confronta lo SHA-256 del file Setup con entrambi i file associati. Interrompi e elimina i download se un valore differisce.
3. Windows non può verificare il publisher di questo installer perché lo sviluppatore non dispone di un certificato di firma codice. Se Windows mostra un avviso o lo blocca, non aggirare l'avviso; usa il Percorso 2.
4. Se si apre normalmente, segui Setup. Verifica Node.js e WebView2, installa sotto `%LOCALAPPDATA%\ClaudeAura`, aggiunge la registrazione **Installed apps** e i collegamenti, quindi apre Aura.

#### Percorso 2 ??ZIP + CMD fallback

1. In **Assets**, scarica `claude-aura-v<version>.zip` e il relativo `.sha256`. Non usare gli archivi **Source code** generati automaticamente da GitHub.
2. Confronta lo SHA-256 dello ZIP con il file associato. Interrompi ed elimina entrambi i file se i valori differiscono.
3. Seleziona **Extract all**. Nella cartella `claude-aura` estratta, fai doppio clic su **Install Claude Aura.cmd**. Non eseguirlo dalla preview ZIP.
4. L'installer CMD/PowerShell leggibile verifica Node.js e WebView2, installa Aura, crea scorciatoie e lo apre. Questo percorso non ha un'identità publisher Authenticode e non aggiunge una voce **Installed apps**.

Dopo uno qualsiasi dei percorsi, effettua l'accesso in Aura se `claude.ai` te lo chiede. Fai clic sul pulsante fluttuante Aura, scegli **Open Studio** e poi **Themes**.

Un asset chiamato `Claude-Aura-Setup-v<version>.exe` senza `-UNSIGNED` è un altro percorso firmato e deve mostrare il publisher indicato nelle note della release. Un asset che termina con `-UNSIGNED-DEV.exe` non è mai pubblico.

L'installazione non applica patch né sostituisce Claude Desktop.

<details>
<summary><strong>Comportamento dell'installatore, posizione dell'applicazione e disinstallazione</strong></summary>

Entrambi i percorsi vengono eseguiti senza prompt dell'amministratore, convalidano i prerequisiti ed effettuano lo swap guardato dell'albero app di Aura. I file dell'applicazione sono installati in:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Crea scorciatoie **Claude Aura**, **Claude Aura Studio** e uninstall nel menu Start e sul desktop. Le impostazioni del tema e i dati di accesso sono memorizzati separatamente dall'applicazione, quindi reinstallare Aura non li sostituisce silenziosamente. Il Setup nativo aggiunge una voce **Installed apps** e un disinstallatore nativo; il percorso ZIP/CMD mantiene il suo shortcut uninstall da script sorgente.

Gli sviluppatori possono clonare il repository e costruire l'installer di sviluppo unsigned con nome esplicito per l'ispezione locale. È distinto dal Setup pubblico unsigned chiaramente contrassegnato. Comandi di build, compilatore pinned, gates di verifica e checklist di rilascio sono documentati nella
[Windows installer guide](../docs/WINDOWS_INSTALLER.md).

### Disinstallazione

Per prima cosa fai clic con il pulsante destro sul pulsante fluttuante Aura e seleziona **Exit Claude Aura**.
Per un'installazione ZIP, apri **Start > Claude Aura > Uninstall Claude Aura** oppure fai doppio clic su **Uninstall Claude Aura.cmd** in una release estratta. Per entrambi i Setup nativi, puoi anche usare **Settings > Apps > Installed apps > Claude Aura > Uninstall**. La voce `.cmd` delega al disinstallatore nativo registrato quando esiste. Il disinstallatore rifiuta di continuare mentre Aura è ancora aperto.

Per impostazione predefinita, la disinstallazione rimuove l'applicazione Aura e i collegamenti ma conserva le impostazioni locali dei temi e il profilo separato di accesso WebView di Aura per una reinstallazione successiva. Il disinstallatore chiede conferma anche prima di rimuovere quelle cartelle. L'opzione di cancellazione rimuove la sessione locale di accesso di Aura; non rimuove mai Claude Desktop, l'account Anthropic dell'utente o i dati dell'account lato server.

</details>
<p align="right">(<a href="#readme-top">torna su</a>)</p>

<a id="theme-showcase"></a>
## Vetrina temi

Il sistema visivo di Aura viene mostrato sotto tramite riferimenti New chat e Conversation.
In alto in questo README compare l’anteprima di riferimento Japanese Film Editorial New chat.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

<a id="japanese-film-editorial"></a>
### Japanese Film Editorial

Carta calda, inchiostro carbone, indaco smorzato e vermiglio contenuto.

<details>
<summary>Vedi vista Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>Scuro · Conversation · showcase documentazione fornita dagli utenti</sub>
</p>

</details>

<a id="japanese-idol"></a>
### Japanese Idol

Crema calda, blush, rosa, lilla perlaceo e dettagli sottili in nastro.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>Chiaro · Nuova chat · showcase documentazione fornita dagli utenti</sub>
</p>

<details>
<summary>Vedi vista Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>Chiaro · Conversation · showcase documentazione fornita dagli utenti</sub>
</p>

</details>

<a id="korean-idol"></a>
### Korean Idol

Bianco freddo, periwinkle, argento olografico e musica glass strutturata.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>Chiaro · Nuova chat · showcase documentazione fornita dagli utenti</sub>
</p>

<details>
<summary>Vedi vista Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>Chiaro · Conversation · showcase documentazione fornita dagli utenti</sub>
</p>

</details>

<details>
<summary><strong>Stato di riferimento e limiti di riuso</strong></summary>

> **Stato di riferimento:** queste immagini fornite dagli utenti comunicano la direzione visiva prevista.
> Possono contenere contenuti interfaccia illustrativi e non sono prove di accettazione live
offerta o prova del comportamento attuale di `claude.ai`. Non sono sfondi tema, non devono essere importati in Aura
> e sono esclusi dai programmi di release.
>
> Le anteprime possono includere UI di prodotti di terze parti, nomi o marchi e artwork ritratto a somiglianza umana.
> La loro presenza non conferisce diritti di riutilizzo. Verifica i diritti applicabili (interfaccia,
> trademark, artwork e likeness) prima di eventuale pubblicazione o redistribuzione.

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>Tutti i temi integrati e ID stabili</strong></summary>

Aura fornisce otto temi integrati in ordine stabile:

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

I built-in sono di sola lettura. Studio crea una copia modificabile quando vuoi personalizzarne uno.

</details>

<p align="right">(<a href="#readme-top">torna su</a>)</p>
<a id="use-aura"></a>
## Usa Aura

| Azione | Cosa fa |
| --- | --- |
| Clic sul pulsante fluttuante Aura | Apre Claude Aura Studio |
| **Themes** | Apre la galleria integrata e salva il tema selezionato |
| **Create a theme** | Crea o modifica un tema personalizzato di proprietà di Aura |
| **Personal wallpaper > Choose wallpaper*** | Seleziona un’immagine locale separata dal tema attivo |
| **Clear wallpaper** | Interrompe l’uso del wallpaper senza cancellare il file sorgente |
| **Original look** | Rimuove lo styling Aura e mostra il sito live senza il tema selezionato |
| **Apply theme** | Ripristina il tema Aura salvato dopo Original look |
| **Open desktop app** | Apre Claude Desktop senza modificarlo |

Il tema selezionato persiste tra i riavvii di Aura. **Original look** disattiva solo la
presentazione di Aura; non elimina temi salvati né artwork personalizzati. **Default** è il primo
tema integrato di Aura; non è la stessa cosa di Original look.

Il launcher fluttuante di Aura resta un controllo circolare compatto. Clicca per aprire Studio, trascina per spostarlo,
o fai clic destro per aprire il menu Aura.

Il wallpaper personale resta collegato al percorso dell’immagine originale. Spostare o rimuovere quel file rende il
wallpaper non disponibile. Gli artwork importati tramite editor seguono un percorso separato: Studio li copia o converte
nei folder tema proprietari di Aura.

<p align="right">(<a href="#readme-top">torna su</a>)</p>

<a id="create-a-custom-theme"></a>
## Crea un tema personalizzato

1. Apri **Claude Aura Studio** dal Desktop o dal menu Start.
2. Apri **Create a theme** e scegli **Customize Default**, oppure apri **Themes**, scegli un
   tema integrato e seleziona **Duplicate to customize**.
3. Regola colori Light e Dark, tipografia, forme, effetti e artwork locali.
4. Controlla layout New chat e Conversation nell’anteprima Studio.
5. Risolvi eventuali avvisi su contrasto o dimensione file.
6. Seleziona **Save theme**.

I file integrati non vengono mai sovrascritti. Se una bozza diventa non valida, resta modificabile
durante il quale Aura continua a mostrare l’ultima versione valida.

PNG, JPEG, WebP o AVIF importati vengono convertiti localmente in asset WebP con budget.
Studio non memorizza il percorso sorgente nel tema. Per editor completo e contract del tema,
consulta [Theme Kit Specification](../docs/THEME_KIT_SPEC.md).

Quando disponibile, Studio può usare una cattura della finestra reale di Aura come sfondo editabile.
La cattura può contenere contenuto della conversazione, resta in memoria solo per la sessione corrente e non
viene mai scritta su disco.

<p align="right">(<a href="#readme-top">torna su</a>)</p>

<a id="built-with"></a>
<a id="how-aura-works"></a>
## Come funziona Aura

| Parte | Scopo |
| --- | --- |
| Windows PowerShell e WinForms | Installer, finestra Aura, Studio, scorciatoie e controlli locali |
| Microsoft Edge WebView2 | Visualizza il sito reale `claude.ai` |
| Node.js 22+ | Valida i temi e costruisce lo styling locale |
| HTML, CSS, JavaScript, SVG e WebP locali | Fornisce styling Aura e asset dei temi integrati |

Il progetto non ha dipendenze npm o font runtime.

<p align="right">(<a href="#readme-top">torna su</a>)</p>

<a id="safety-and-privacy"></a>
## Sicurezza e privacy

- Aura carica il sito HTTPS live `claude.ai` in Microsoft Edge WebView2.
- Le pagine del provider di accesso non sono tematizzate.
- Aura non apre una porta remote-debugging né applica patch a Claude Desktop.
- I file tema e gli artwork importati restano in cartelle locali di Aura.
- La pagina live continua a connettersi normalmente ad Anthropic.
- Il profilo WebView contiene dati di sessione di accesso e deve essere protetto.
- Le capture live-page di Studio restano in memoria per la sessione di editing e non vengono salvate su disco.
- Non selezionare un’immagine di sfondo sensibile; la pagina live può accedere tecnicamente ai dati DOM nel proprio processo.
- L’uso del servizio live è soggetto a [Consumer Terms](https://www.anthropic.com/terms) e
  [Usage Policy](https://www.anthropic.com/legal/aup) attuali.

Per i confini di fiducia consulta [SECURITY.md](./SECURITY.md) e per login, caricamento, tema, immagine e WebView2
[Troubleshooting](../docs/TROUBLESHOOTING.md).

<a id="local-data"></a>
<details>
<summary><strong>Cartelle dati locali e conservazione alla disinstallazione</strong></summary>

Aura separa application, settings, themes, drafts e profilo browser:

| Path | Contents |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Applicazione Aura installata |
| `%LOCALAPPDATA%\ClaudeAura\data` | Impostazioni, log e stato locale di Aura |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Temi personalizzati salvati e artwork derivati |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Bozze Studio in corso |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Profilo WebView2 separato per il login di Aura |

Tratta la cartella `webview` come qualsiasi profilo browser con accesso autenticato.
Non pubblicare né condividere. La disinstallazione predefinita mantiene `data` e `webview`; usa la rimozione esplicita
a sola quando vuoi anche cancellare impostazioni locali, temi e profilo di accesso separato.

</details>

<p align="right">(<a href="#readme-top">torna su</a>)</p>
<a id="roadmap"></a>
## Roadmap

- [x] Companion Windows WebView2 dedicato e **Original look** reversibile
- [x] Otto temi integrati stabili con supporto Light e Dark
- [ ] Completare e revisionare l’editor visuale no-code di Studio
- [ ] Completare e approvare Aura Code per il Remote Control locale ufficiale di Claude Code, con terminal-theme export corrispondente
- [ ] Pubblicare il tutorial del tema personalizzato da 30 minuti
- [ ] Eseguire lo sweep finale di verifica della release

Consulta l’
[implementation report](../docs/IMPLEMENTATION_REPORT.md) e
[issues del repository](https://github.com/kaihuang1425/claude-aura/issues) per lo stato pubblico.
Una anteprima di riferimento non sostituisce la prova di accettazione live richiesta da Aura.

<p align="right">(<a href="#readme-top">torna su</a>)</p>

<a id="support"></a>
## Supporto e documentazione

Inizia con [Troubleshooting](../docs/TROUBLESHOOTING.md). Per un bug riproducibile o una richiesta funzione,
usare la
[pagina Issues del repository](https://github.com/kaihuang1425/claude-aura/issues).

Quando segnali un bug, includi versioni di Windows, Node.js, WebView2, ID del tema attivo e passaggi di riproduzione.
Controlla i log prima di condividerli; il log UI di Aura si trova in:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Segnala problemi di sicurezza tramite advisory security privata del repository, come descritto in
[SECURITY.md](./SECURITY.md).

<a id="documentation-map"></a>
### Mappa documentazione

- [Troubleshooting](../docs/TROUBLESHOOTING.md)
- [Security and trust boundary](./SECURITY.md)
- [Theming guide](../docs/THEMING.md)
- [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)
- [Implementation report](../docs/IMPLEMENTATION_REPORT.md)
- [File Manifest](../docs/FILE_MANIFEST.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Repository issues](https://github.com/kaihuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>Controlli di contribuzione e limiti del progetto</strong></summary>

Esegui i controlli richiesti prima di inviare una modifica:

```powershell
npm run check
npm run verify:cycle
```

Per una singola verifica di tema integrato:

```powershell
node scripts/theme-cli.mjs qa <id>
```

Mantieni questi limiti:

- Non aggiungere dipendenze npm o font runtime.
- Mantieni invariati gli otto ID tema stabili e l’ordine.
- Non distribuire HTML dell’interfaccia Claude ricostruita come contenuto del prodotto.
- Non presentare immagini di riferimento come prova di accettazione UI.
- Includi origine, licenza e informazioni di distribuzione per i media contributi.

Prima di modificare il sistema tema o l’albero release, consulta
[CONTRIBUTING.md](./CONTRIBUTING.md), la
[Theming guide](../docs/THEMING.md),
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md),
[File Manifest](../docs/FILE_MANIFEST.md).

</details>

<p align="right">(<a href="#readme-top">torna su</a>)</p>

<a id="charitable-support"></a>
## Supporto benefico

Claude Aura non accetta donazioni personali, tip, sponsorship, referral payment o altro sostegno finanziario.
Il proprietario è attualmente nel Regno Unito secondo
[Student route conditions](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student),
che vieta attività imprenditoriali o di business salvo casi limitati.
Per evitare possibili conflitti, il proprietario non può ricevere donazioni o tip legati al progetto
finché tali condizioni sono in vigore.

[Se Claude Aura ti è utile, il modo più semplice e non economico per sostenerlo è assegnare una stella al repository su GitHub.](https://github.com/kaihuang1425/claude-aura)

<details>
<summary><strong>Contesto Student-route, nonprofit indipendenti e limiti delle donazioni</strong></summary>

I lettori che vogliono sostenere lavori di interesse pubblico possono donare direttamente a uno dei
progetti nonprofit indipendenti:

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  aiuta persone colpite da conflitti e disastri, inclusi rifugiati che ricostruiscono la propria vita nel Regno Unito.
  Il più ampio International Rescue Committee partecipa anche a
  [Claude Corps](https://www.anthropic.com/news/claude-corps).
- [CodePath](https://www.every.org/codepath) offre formazione tecnica gratuita
  e lavora con Anthropic come partner nonprofit per
  [Claude Corps](https://www.anthropic.com/news/claude-corps).

Questi link portano direttamente a terze parti. Claude Aura e il proprietario non raccolgono,
processano, controllano, ricevono o beneficiano finanziariamente da donazioni.
Le organizzazioni gestiscono la loro elaborazione di donazioni e le ricevute. La loro presenza in lista non implica
affiliazione, sponsorship, approvazione o partnership ufficiale di fund-raising con Claude Aura.

</details>

<a id="license-and-notices"></a>
## Licenza e avvisi

Il software prodotto dal progetto viene distribuito sotto la
[MIT License](./LICENSE). Consulta anche
[NOTICE.md](./NOTICE.md) e [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

La MIT License non concede diritti su nomi, marchi, interfaccia, sito web o applicazioni Anthropic.
I sottotitoli showcase non concedono diritti di riutilizzo dell’UI mostrata, artwork, nomi, marchi o
somiglianze umane. Rimangono validi i riferimenti a fonti e diritti specifici per file.

Consulta le attuali
[Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
e [Consumer Terms](https://www.anthropic.com/terms). Prima di pubblicare, modificare o redistribuire nomi,
marchi, catture dell’interfaccia, artwork o somiglianze riconoscibili protette, ottieni l’autorizzazione
appropriata dal rightsholder. Questo repository e questa README non concedono tale permesso.

<a id="acknowledgments"></a>
## Ringraziamenti

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) ha ispirato il flusso di validazione
  loopback originale e il pattern showcase accessibile.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin) ha ispirato il mapping semantico iniziale dei temi.
- [Best README Template](https://github.com/othneildrew/Best-README-Template) ha ispirato la struttura
  orientata al lettore di questo README.
- Microsoft Edge WebView2 fornisce il runtime del browser incorporato.

Le licenze e provenance dettagliate sono registrate in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). Gli acknowledgement non implicano affiliazione,
sponsorizzazione o approvazione.

<p align="right">(<a href="#readme-top">torna su</a>)</p>
