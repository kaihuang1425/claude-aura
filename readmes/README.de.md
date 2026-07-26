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
  <strong>Deutsch</strong> ·
  <a href="./README.it.md">Italiano</a> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Gebens Sie der Live-Claude-Website unter Windows ein persönliches, reversibles Theme.</strong><br>
  Lokale Themes · Kein Claude Desktop Patching · Originalansicht mit einem Klick zurückholen
</p>

<p align="center">
  <a href="#getting-started">Schnellstart</a> ·
  <a href="#theme-showcase">Themes ansehen</a> ·
  <a href="#create-a-custom-theme">Theme erstellen</a> ·
  <a href="../docs/TROUBLESHOOTING.md">Fehlerbehebung</a> ·
  <a href="./SECURITY.md">Sicherheit</a>
</p>

<p align="center">
  <a href="https://github.com/kaihuang1425/claude-aura"><strong>Wenn Claude Aura für dich nützlich ist, gib dem Projekt auf GitHub einen Stern.</strong></a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Dunkel · Neue Chat · Benutzer-gespendete Dokumentations-Showcase</sub>
</p>

<p align="center"><sub>Referenzvorschau · kein importierbarer Theme-Hintergrund und kein Live-Bestätigungsnachweis</sub></p>

> **Independent project.** Claude Aura ist ein unabhängiges Projekt und ist nicht mit,
> beauftragt, gesponsert oder von Anthropic PBC bestätigt. Aura zeigt die Live-Website von
> `claude.ai`; es stellt nicht Claude bereit oder ändert installierte Anthropic-Anwendungen.
> Claude, Anthropic und zugehörige Namen und Marken gehören Anthropic PBC. Die Projektlizenz
> gewährt keine Rechte an diesen Materialien.

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
<summary><strong>Inhalt</strong></summary>

- [Claude Aura](#claude-aura)
  - [Warum Aura](#warum-aura)
  - [Schnellstart](#schnellstart)
    - [Voraussetzungen](#voraussetzungen)
    - [Installation](#installation)
    - [Deinstallation](#deinstallation)
  - [Theme-Showcase](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Aura verwenden](#aura-verwenden)
  - [Eigenes Theme erstellen](#eigenes-theme-erstellen)
  - [Wie Aura funktioniert](#wie-aura-funktioniert)
  - [Sicherheit und Datenschutz](#sicherheit-und-datenschutz)
  - [Roadmap](#roadmap)
  - [Support und Dokumentation](#support-und-dokumentation)
    - [Dokumentenübersicht](#dokumentenübersicht)
  - [Wohltätige Unterstützung](#wohltätige-unterstützung)
  - [Lizenz und Hinweise](#lizenz-und-hinweise)
  - [Danksagung](#danksagung)

</details>
<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Warum Aura

- **Nutzung der Live-Claude-Website.** Aura behält die echte Oberfläche und native Controls,
  statt sie durch einen rekonstruierten Screen zu ersetzen.
- **Lokale und reversible Änderung.** Es wird kein Patch auf Claude Desktop aufgebracht
  und **Original look** entfernt die Aura-Präsentationsschicht mit einem Klick.
- **Beginnen Sie mit acht integrierten Themes.** Jedes ist ein stabiler, schreibgeschützter Startpunkt.
- **Erstellen Sie Themes ohne Überschreiben der Originale.** Claude Aura Studio unterstützt
  lokale Farben, Typografie, Formen, Effekte und Artwork.

Aura 0.3 theme't aktuell nur die Live-Website. Weder Claude Desktop Code noch der Claude Code
Terminal sind noch gethemed; der normale Chat innerhalb von Aura bekommt keinen lokalen Projektzugriff.
Vor dem Final-Release muss Aura Code einen blockierenden Release-Nachweis mit einer offiziell gethemeden
[Remote Control](https://code.claude.com/docs/en/remote-control)-Session auf live `claude.ai/code`
bestanden haben; der passende terminal-theme export deckt eingeschränkte Umgebungen ohne Patch von
Claude Desktop ab.

<details>
<summary><strong>Vollständige Fähigkeiten und Ausschlüsse</strong></summary>

Claude Aura öffnet die echte Website `claude.ai` in einem dedizierten Microsoft Edge
WebView2-Fenster und wendet ein lokales visuelles Theme an. Es richtet sich an Nutzer,
die einen persönlicheren Workspace ohne Patch von Claude Desktop möchten, ohne die Live-UI durch
einen Screenshot zu ersetzen.

| Aura macht | Aura macht nicht |
| --- | --- |
| Lädt die Live-UI `claude.ai` in WebView2 | Ersetzt Claude durch eine rekonstruierte UI |
| Wendet reversible lokale Styling an | Patcht Claude Desktop, `app.asar`, Windows-Pakete oder Codesignaturen |
| Beinhaltet acht integrierte Themes | Ändert Claude-Konten, Chats, API-Schlüssel, Modelle oder Anbieter-Einstellungen |
| Bietet Studio für lokale Custom-Themes | Beansprucht ein Anthropic-Produkt oder offizielles Theme-System zu sein |
| Stellt **Original look** in der App bereit | Löscht gespeicherte Themes beim Ausschalten des Stylings |

</details>

<p align="right">(<a href="#readme-top">nach oben</a>)</p>
<a id="getting-started"></a>
## Schnellstart

<a id="requirements"></a>
### Voraussetzungen

- Windows 10 oder Windows 11
- Internetzugang und Claude-Konto
- [Node.js 22 oder neuer](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 ist auf den meisten aktuellen Windows-Rechnern vorhanden. Wenn Aura kein Browserfenster öffnen kann,
installieren oder reparieren Sie Evergreen WebView2 Runtime und versuchen Sie es erneut.
Claude Desktop ist optional und bleibt eine separate Anwendung.

<a id="installation"></a>
### Installation

1. Laden Sie das
   [aktuellste Release-ZIP](https://github.com/kaihuang1425/claude-aura/releases) herunter.
2. Klicken Sie im File Explorer mit der rechten Maustaste auf die ZIP und wählen Sie **Extract All**.
3. Öffnen Sie den entpackten Ordner und doppelklicken Sie **Install Claude Aura.cmd**.
4. Warten Sie, bis der Installer schließt und das Fenster **Claude Aura** öffnet.
5. Melden Sie sich in Aura an, falls `claude.ai` danach fragt.
6. Klicken Sie auf den schwebenden Aura-Button, um Studio zu öffnen, und wählen Sie dann **Themes**.

Die Installation patcht oder ersetzt Claude Desktop nicht.

<details>
<summary><strong>Installationsverhalten, Anwendungsort, Dev-Checkouts und Deinstallation</strong></summary>

Der nicht-elevierte Installer führt interne Prüfungen aus, dann kopiert er die Anwendungsdateien nach:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Es erstellt Shortcuts für **Claude Aura** und **Claude Aura Studio** auf dem Desktop und im Startmenü.
Theme-Einstellungen und Login-Daten werden getrennt gespeichert, sodass ein Neuinstallieren von Aura sie nicht
still leise ersetzt.

Entwickler können statt eines Downloads auch das Repository klonen und den gleichen Installer aus dem Checkout
verwenden. Ein Checkout führt vor der Installation die vollständige Test-Suite aus.

<a id="uninstall"></a>
### Deinstallation

Klicken Sie zuerst mit der rechten Maustaste auf den schwebenden Aura-Button und wählen
**Exit Claude Aura**.
Öffnen Sie dann **Start > Claude Aura > Uninstall Claude Aura** oder doppelklicken Sie in einer entpackten
Release auf **Uninstall Claude Aura.cmd**. Der Uninstaller läuft nicht, solange Aura noch geöffnet ist.

Standardmäßig entfernt die Deinstallation die Aura-Anwendung und Shortcuts, behält aber lokale Theme-Einstellungen
und das getrennte WebView-Login-Profil von Aura für eine spätere Neuinstallation. Der Uninstaller fragt,
ob diese Ordner ebenfalls gelöscht werden sollen. Diese optionale Bereinigung löscht die lokale Aura-Login-Session;
Claude Desktop, das Anthropic-Konto des Nutzers oder serverseitige Kontodaten werden dabei niemals gelöscht.

</details>
<p align="right">(<a href="#readme-top">nach oben</a>)</p>

<a id="theme-showcase"></a>
## Theme-Showcase

Aura zeigt sein visuelles System unten über New chat- und Conversation-Referenzen. Die
vorgestellte Vorschau von Japanese Film Editorial New chat steht oben in diesem README.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

<a id="japanese-film-editorial"></a>
### Japanese Film Editorial

Warme Papieroptik, Holzkohle-Tinte, gedämpftes Indigo und zurückhaltendes Zinnober.

<details>
<summary>Conversation-Ansicht anzeigen</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>Dunkel · Conversation · benutzerbereitgestellte Dokumentations-Showcase</sub>
</p>

</details>

<a id="japanese-idol"></a>
### Japanese Idol

Warme Cream, Blush, Rose, perlmuttartiges Lilac und feine Bändchen-Details.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>Hell · New chat · benutzerbereitgestellte Dokumentations-Showcase</sub>
</p>

<details>
<summary>Conversation-Ansicht anzeigen</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>Hell · Conversation · benutzerbereitgestellte Dokumentations-Showcase</sub>
</p>

</details>

<a id="korean-idol"></a>
### Korean Idol

Kühles Weiß, Periwinkle, holografisches Silber und strukturierter Music-Glass-Look.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>Hell · New chat · benutzerbereitgestellte Dokumentations-Showcase</sub>
</p>

<details>
<summary>Conversation-Ansicht anzeigen</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>Hell · Conversation · benutzerbereitgestellte Dokumentations-Showcase</sub>
</p>

</details>

<details>
<summary><strong>Referenzstatus und Wiederverwendungsgrenzen</strong></summary>

> **Referenzstatus:** Diese nutzerbereitgestellten Bilder beschreiben die beabsichtigte visuelle Ausrichtung.
> Sie können illustrativen Interface-Inhalt enthalten und sind kein Live-Akzeptanzbeweis oder Beweis des
> aktuellen Verhaltens von `claude.ai`. Sie sind keine Theme-Hintergründe, dürfen nicht in Aura importiert
> werden und sind aus Release-Installern ausgeschlossen.
>
> Die Vorschauen können Produkt-UI Dritter, Namen/Marken sowie human-like Portrait-Art enthalten.
> Ihre Bereitstellung gewährt keine Nutzungsrechte. Überprüfen Sie vor Veröffentlichung oder Weiterverteilung
die entsprechenden Interface-, Marken-, Kunst- und likeness-rechte.

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>Alle integrierten Themes und stabilen IDs</strong></summary>

Aura enthält acht integrierte Themes in stabiler Reihenfolge:

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

Integrierte Themes sind schreibgeschützt. Studio erstellt eine editierbare Kopie, wenn du ein Theme anpassen möchtest.

</details>

<p align="right">(<a href="#readme-top">nach oben</a>)</p>
<a id="use-aura"></a>
## Aura verwenden

| Aktion | Bedeutung |
| --- | --- |
| Schwebender Aura-Button | Öffnet Claude Aura Studio |
| **Themes** | Öffnet die integrierte Galerie und speichert das gewählte Theme |
| **Create a theme** | Erstellt oder bearbeitet ein Aura-eigenes Custom Theme |
| **Personal wallpaper > Choose wallpaper*** | Wählt ein lokales Bild unabhängig vom aktiven Theme |
| **Clear wallpaper** | Entfernt das Wallpaper ohne Quelldatei zu löschen |
| **Original look** | Entfernt Aura-Styling und zeigt die Live-Site ohne ausgewähltes Theme |
| **Apply theme** | Stellt das gespeicherte Aura-Theme nach Original look wieder her |
| **Open desktop app** | Öffnet Claude Desktop ohne Änderung |

Das ausgewählte Theme bleibt über Aura-Neustarts bestehen. **Original look** schaltet nur die Präsentationsschicht
ab; gespeicherte Themes oder benutzerdefinierte Artworks bleiben erhalten. **Default** ist das erste integrierte
Theme von Aura; es ist nicht dasselbe wie Original look.

Der schwebende Aura-Launcher bleibt ein kompakter Rundbutton. Klicke ihn für Studio, ziehe ihn zum Verschieben
oder öffne über Rechtsklick das Aura-Menü.

Personal wallpaper bleibt am ursprünglichen Bildpfad gebunden. Verschieben oder Löschen dieser Datei macht
Wallpaper nicht mehr verfügbar. Durch den Editor importierte Artworks folgen einem anderen Pfad:
Studio kopiert oder konvertiert sie in Aura-eigene Theme-Ordner.

<p align="right">(<a href="#readme-top">nach oben</a>)</p>

<a id="create-a-custom-theme"></a>
## Eigenes Theme erstellen

1. Öffnen Sie **Claude Aura Studio** über Desktop oder Startmenü.
2. Öffnen Sie **Create a theme** und wählen Sie **Customize Default** oder öffnen Sie **Themes**, wählen Sie ein
   integriertes Theme und **Duplicate to customize**.
3. Passen Sie Light- und Dark-Farben, Typografie, Formen, Effekte und lokale Artworks an.
4. Prüfen Sie New chat und Conversation im Studio-Preview.
5. Beheben Sie Kontrast- oder Dateigrößenwarnungen.
6. Wählen Sie **Save theme**.

Integrierte Dateien werden nie überschrieben. Wird ein Entwurf ungültig, bleibt er weiterhin editierbar,
während Aura weiterhin die letzte gültige Version anzeigt.

Importierte PNG-, JPEG-, WebP- oder AVIF-Artworks werden lokal in budgetierte WebP-Assets konvertiert.
Studio speichert den Quellpfad nicht im Theme. Für den vollständigen Editor und das Theme Contract siehe
die [Theme Kit Specification](../docs/THEME_KIT_SPEC.md).

Wenn verfügbar, kann Studio ein Live-Fenster-Capture von Aura als Bearbeitungs-Hintergrund verwenden.
Dieser Capture kann Gesprächsinhalte enthalten, bleibt nur für die aktuelle Bearbeitungssitzung im Speicher
und wird nie auf die Festplatte geschrieben.

<p align="right">(<a href="#readme-top">nach oben</a>)</p>

<a id="built-with"></a>
<a id="how-aura-works"></a>
## Wie Aura funktioniert

| Teil | Zweck |
| --- | --- |
| Windows PowerShell und WinForms | Installer, Aura-Fenster, Studio, Shortcuts und lokale Controls |
| Microsoft Edge WebView2 | Zeigt die echte `claude.ai` Website |
| Node.js 22+ | Validiert Themes und erstellt das lokale Theme-Styling |
| Lokales HTML, CSS, JavaScript, SVG und WebP | Liefert Aura-Styling und integrierte Theme-Assets |

Das Projekt hat keine npm-Laufzeit- oder Font-Abhängigkeiten.

<p align="right">(<a href="#readme-top">nach oben</a>)</p>

<a id="safety-and-privacy"></a>
## Sicherheit und Datenschutz

- Aura lädt die Live-HTTPS-Website `claude.ai` in Microsoft Edge WebView2.
- Login-Provider-Seiten sind nicht gethemed.
- Aura öffnet keinen Remote-Debugging-Port und patcht kein Claude Desktop.
- Theme-Dateien und importierte Artworks liegen in Aura-eigenen lokalen Ordnern.
- Die Live-Webseite verbindet sich normal weiterhin mit Anthropic.
- Das WebView-Profil enthält Login-Sitzungsdaten und muss geschützt werden.
- Studio Live-Page-Captures bleiben für die aktive Sitzung im Speicher und werden nicht gespeichert.
- Wählen Sie kein sensibles Hintergrundbild; die Live-Seite kann technisch auf DOM-Daten im eigenen Prozess zugreifen.
- Der Live-Service unterliegt den aktuellen [Consumer Terms](https://www.anthropic.com/terms)
  und der [Usage Policy](https://www.anthropic.com/legal/aup) von Anthropic.

Lesen Sie [SECURITY.md](./SECURITY.md) für die Vertrauensgrenze und
[Troubleshooting](../docs/TROUBLESHOOTING.md) für Login, Ladezustand, Theme, Bild und WebView2-Hilfe.

<a id="local-data"></a>
<details>
<summary><strong>Lokale Datenordner und Deinstallationsaufbewahrung</strong></summary>

Aura trennt application, settings, themes, drafts und Browserprofil:

| Path | Contents |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Installierte Aura-Anwendung |
| `%LOCALAPPDATA%\ClaudeAura\data` | Einstellungen, Logs und lokaler Aura-Status |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Gespeicherte Custom-Themes und abgeleitete Artworks |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Laufende Studio-Entwürfe |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Getrenntes WebView2-Login-Profil von Aura |

Behandle den Ordner `webview` wie ein angemeldetes Browserprofil. Nicht veröffentlichen oder teilen.
Die Standard-Deinstallation behält `data` und `webview`; wähle die explizite Entfernung nur,
wenn du lokale Einstellungen, Themes und das separate Login-Profil ebenfalls löschen willst.

</details>

<p align="right">(<a href="#readme-top">nach oben</a>)</p>
<a id="roadmap"></a>
## Roadmap

- [x] Dedizierter Windows WebView2 Companion und reversibler **Original look**
- [x] Acht stabile integrierte Themes mit Light- und Dark-Support
- [ ] Vollständiger No-Code Studio Visual Editor fertigstellen und prüfen
- [ ] Aura Code für den offiziellen lokalen Claude Code Remote Control freigeben und termi-nal-theme export validieren
- [ ] 30-minütiges Custom-Theme-Tutorial veröffentlichen
- [ ] Endgültigen Release-Verification-Sweep durchführen

Sehen Sie den
[implementation report](../docs/IMPLEMENTATION_REPORT.md) und die
[Repository-Issues](https://github.com/kaihuang1425/claude-aura/issues) für den öffentlichen Status an.
Eine Referenzvorschau ersetzt keinen erforderlichen Live-Aura-Akzeptanzbeleg.

<p align="right">(<a href="#readme-top">nach oben</a>)</p>

<a id="support"></a>
## Support und Dokumentation

Starten Sie mit [Troubleshooting](../docs/TROUBLESHOOTING.md). Für reproduzierbare Fehlerberichte
oder Feature-Requests nutzen Sie die
[Issue- Seite des Repos](https://github.com/kaihuang1425/claude-aura/issues).

Bei Fehlerberichten geben Sie Windows-, Node.js- und WebView2-Versionen, die aktive Theme-ID und die
nachvollziehbaren Schritte an. Prüfen Sie Logs vor dem Teilen. Der Aura UI-Log liegt hier:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Sicherheitsprobleme bitte über ein private security advisory im Repo melden, wie in
[SECURITY.md](./SECURITY.md) beschrieben.

<a id="documentation-map"></a>
### Dokumentenübersicht

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
<summary><strong>Mitwirkungs-Checks und Projektgrenzen</strong></summary>

Führen Sie vor dem Einreichen die erforderlichen Checks aus:

```powershell
npm run check
npm run verify:cycle
```

Für ein einzelnes integriertes Theme-Audit:

```powershell
node scripts/theme-cli.mjs qa <id>
```

Bitte bewahren Sie diese Projektgrenzen:

- Keine zusätzlichen npm- oder Runtime-Font-Abhängigkeiten.
- Behalten Sie die Reihenfolge und die acht stabilen Theme-IDs bei.
- Verteilen Sie keine rekonstruierte Claude-Interface-HTML als Produktinhalt.
- Veröffentlichen Sie keine Referenzbilder als UI-Akzeptanznachweis.
- Fügen Sie für beigetragenes Material Quelle, Lizenz und Distributionsangaben hinzu.

Weitere Informationen vor Änderungen am Themensystem oder Release-Baum finden Sie in
[CONTRIBUTING.md](./CONTRIBUTING.md), [Theming guide](../docs/THEMING.md),
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md) und [File Manifest](../docs/FILE_MANIFEST.md).

</details>

<p align="right">(<a href="#readme-top">nach oben</a>)

<a id="charitable-support"></a>
## Wohltätige Unterstützung

Claude Aura akzeptiert keine persönlichen Spenden, Trinkgelder, Sponsorings,
Referral-Zahlungen oder sonstige finanzielle Unterstützung. Der Eigentümer befindet sich derzeit im
United Kingdom unter den
[Student route conditions](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student),
die außer in eng begrenzten Fällen keine Selbständigkeit oder Geschäftstätigkeit erlauben.
Um mögliche Konflikte mit diesen Bedingungen zu vermeiden, kann der Eigentümer während ihrer Gültigkeit
keine projektbezogenen Spenden oder Tips annehmen.

[Wenn Claude Aura für dich nützlich ist, ist der einfachste nicht-monetäre Weg, es zu unterstützen, dem Repository auf GitHub einen Stern zu geben.](https://github.com/kaihuang1425/claude-aura)

<details>
<summary><strong>Student-route-Kontext, unabhängige Nonprofits und Spendenregeln</strong></summary>

Leser, die mit verwandter gemeinnütziger Arbeit helfen möchten, können direkt an folgende
unabhängige Nonprofits spenden:

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  hilft Menschen in Konflikten und Katastrophen, einschließlich Flüchtlingen beim
  Wiederaufbau im Vereinigten Königreich.
  Die größere International Rescue Committee nimmt auch an
  [Claude Corps](https://www.anthropic.com/news/claude-corps) teil.
- [CodePath](https://www.every.org/codepath) bietet kostenlose technische Bildung
  und arbeitet mit Anthropic als Nonprofit-Partner für
  [Claude Corps](https://www.anthropic.com/news/claude-corps).

Diese Links führen direkt zu Drittanbietern. Claude Aura und der Eigentümer sammeln,
verarbeiten, kontrollieren, erhalten oder profitieren finanziell aus Spenden nicht.
Die Organisationen verwalten ihre eigene Spendenabwicklung und Belege. Ihr Nennen
impliziert keine Zugehörigkeit, kein Sponsoring, keine Billigung oder offizielle
Fundraising-Partnerschaft mit Claude Aura.

</details>

<a id="license-and-notices"></a>
## Lizenz und Hinweise

Vom Projekt stammende Software wird unter der [MIT License](./LICENSE) verteilt.
Siehe auch [NOTICE.md](./NOTICE.md) und [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

Die MIT License verleiht keine Rechte an Anthropic-Namen, Marken, Oberfläche, Website oder Anwendungen.
Showcase-Beschriftungen gewähren keine Rechte zur Wiederverwendung der gezeigten UI, Artworks,
Namen, Marken oder menschenähnlichen Darstellungen. Dateispezifische Quellen- und Rechtehinweise
gelten weiterhin.

Bitte beachten Sie die aktuellen
[Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
und [Consumer Terms](https://www.anthropic.com/terms).
Holen Sie vor Veröffentlichung, Änderung oder Weiterverbreitung geschützter Namen,
Marken, Interface-Captures, Artwork oder erkennbarer likenesses die erforderliche Genehmigung
des Rechteinhabers ein. Dieses Repository und die README gewähren diese Erlaubnis nicht.

<a id="acknowledgments"></a>
## Danksagung

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) hat den ursprünglichen loopback-Validierungs-Workflow
  und das zugängliche Showcase-Muster inspiriert.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin) hat das frühe semantische Theme-Mapping inspiriert.
- [Best README Template](https://github.com/othneildrew/Best-README-Template) hat die leserzentrierte Struktur dieses README geprägt.
- Microsoft Edge WebView2 liefert das eingebettete Browser-Runtime.

Detaillierte Lizenzen und Herkunft sind in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) dokumentiert.
Acknowledgment bedeutet keine Zugehörigkeit, kein Sponsoring und keine Freigabe.

<p align="right">(<a href="#readme-top">nach oben</a>)</p>
