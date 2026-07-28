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
  <a href="./README.it.md">Italiano</a> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <strong>Polski</strong> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Nadaj stronie internetowej Claude w czasie rzeczywistym personalizowany, odwracalny motyw na Windows.</strong><br>
  Lokalne motywy · Brak łatania Claude Desktop · Powrót do oryginalnego wyglądu w jednym kliknięciu
</p>

<p align="center">
  <a href="#getting-started">Pierwsze kroki</a> ·
  <a href="#theme-showcase">Zobacz motywy</a> ·
  <a href="#create-a-custom-theme">Tworzenie motywu</a> ·
  <a href="../docs/TROUBLESHOOTING.md">Rozwiązywanie problemów</a> ·
  <a href="./SECURITY.md">Bezpieczeństwo</a>
</p>

<p align="center">
  <a href="https://github.com/kaihuang1425/claude-aura"><strong>Jeśli Claude Aura jest dla Ciebie przydatny, zostaw gwiazdkę temu projektowi na GitHub.</strong></a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Ciemny · Nowa rozmowa · pokaz dokumentacyjny dostarczony przez użytkownika</sub>
</p>

<p align="center"><sub>Podgląd referencyjny · nie jest importowalnym tłem motywu ani dowodem akceptacji na żywo</sub></p>

> **Independent project.** Claude Aura jest niezależnym projektem i nie jest powiązany,
> sponsorowany, zatwierdzony ani wspierany przez Anthropic PBC. Aura wyświetla stronę
> `claude.ai` w wersji live; nie dostarcza Claude ani nie modyfikuje zainstalowanych aplikacji Anthropic.
> Claude, Anthropic i powiązane nazwy/znaki to własność Anthropic PBC. Licencja projektu
> nie przyznaje praw do tych materiałów.

<details>
<summary><strong>Notatka o znakach towarowych przed wydaniem publicznym lub komercyjnym</strong></summary>

> **Przed publicznym lub komercyjnym wydaniem:** Obowiązujące
> [Wytyczne dotyczące znaków towarowych](https://www.anthropic.com/legal/trademark-guidelines)
> Anthropic wymagają wcześniejszej zgody na używanie ich nazw i znaków oraz zabraniają
> modyfikacji znaków. Oświadczenie o braku powiązań nie stanowi pozwolenia. Wydanie,
> które zachowuje nazwę **Claude Aura** lub wordmark Claude w stylu motywu,
> wymaga pisemnej zgody i odpowiedniego przeglądu prawnego.

</details>

<a id="contents"></a>
<details>
<summary><strong>Spis treści</strong></summary>

- [Claude Aura](#claude-aura)
  - [Dlaczego Aura](#why-aura)
  - [Szybki start](#quick-start)
    - [Wymagania](#requirements)
    - [Instalacja](#installation)
    - [Odinstalowanie](#uninstall)
  - [Przegląd motywów](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Korzystanie z Aura](#use-aura)
  - [Tworzenie własnego motywu](#create-a-custom-theme)
  - [Jak działa Aura](#how-aura-works)
  - [Bezpieczeństwo i prywatność](#safety-and-privacy)
  - [Plan rozwoju](#roadmap)
  - [Wsparcie i dokumentacja](#support-and-documentation)
    - [Mapa dokumentacji](#documentation-map)
  - [Wsparcie charytatywne](#charitable-support)
  - [Licencja i uwagi](#license-and-notices)
  - [Podziękowania](#acknowledgments)

</details>

<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Dlaczego Aura

- **Używaj żywej strony Claude.** Aura zachowuje rzeczywisty interfejs i natywne
  kontrolki zamiast zastępować je odtworzonym ekranem.
- **Trzymaj zmiany lokalnie i odwracalnie.** Aura stosuje lokalny styl bez patchowania
  Claude Desktop, a opcja **Original look** usuwa warstwę prezentacji Aura jednym kliknięciem.
- **Zacznij od ośmiu wbudowanych motywów.** Każdy z nich jest stabilnym punktem
  startowym (tylko do odczytu) dla spersonalizowanego środowiska pracy.
- **Twórz motywy bez nadpisywania oryginałów.** Claude Aura Studio obsługuje kolory,
  typografię, kształty, efekty i grafikę lokalnie.

Aura 0.3 obecnie styluje jedynie stronę live. Nie obejmuje jeszcze Claude Desktop Code ani
 terminala Claude Code, a zwykły czat w Aura nie uzyskuje dostępu do lokalnych projektów.
Przed wydaniem finalnym Aura Code musi przejść blokującą weryfikację z oficjalną
sesją [Remote Control](https://code.claude.com/docs/en/remote-control) z wystylowaną
wersją `claude.ai/code`; eksport terminal-theme do ograniczonych środowisk odbywa się bez
patchowania Claude Desktop.

<details>
<summary><strong>Pełne możliwości i wyłączenia</strong></summary>

Claude Aura otwiera prawdziwą stronę `claude.ai` w dedykowanym oknie Microsoft Edge
WebView2 i stosuje lokalny motyw wizualny. Projekt jest przeznaczony dla osób,
które chcą bardziej osobistego środowiska pracy bez patchowania Claude Desktop ani
zastępowania żywego interfejsu zrzutem ekranu.

| Aura robi | Aura nie robi |
| --- | --- |
| Ładuje żywy interfejs `claude.ai` w WebView2 | Zastępuje Claude odtworzonym interfejsem |
| Stosuje odwracalny lokalny styl | Łata Claude Desktop, `app.asar`, pakiety Windows lub podpisy kodu |
| Zawiera osiem wbudowanych motywów | Zmienia konta, rozmowy, klucze API, modele ani ustawienia dostawcy |
| Udostępnia Studio do lokalnych motywów niestandardowych | Twierdzi, że jest produktem Anthropic lub oficjalnym systemem motywów |
| Oferuje **Original look** w aplikacji | Usuwa zapisane motywy po wyłączeniu stylowania |

</details>

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>
<a id="getting-started"></a>
## Szybki start

### Wymagania

- Windows 10 lub Windows 11
- Dostęp do Internetu i konto Claude
- [Node.js 22 lub nowszy](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 jest obecny na większości współczesnych komputerów z Windowsem. Jeśli Aura nie może otworzyć
swojego okna przeglądarki, zainstaluj lub napraw Evergreen WebView2 Runtime i spróbuj ponownie.
Claude Desktop jest opcjonalny i pozostaje oddzielną aplikacją.

### Instalacja

Otwórz [najnowszą wersję](https://github.com/kaihuang1425/claude-aura/releases) i wybierz jedną z tych ścieżek. Obie instalują tę samą wersję dla bieżącego konta Windows.

| Path | Use it when | Download |
| --- | --- | --- |
| **Unsigned Setup** | Chcesz prostszy instalator prowadzący, a Windows otwiera go normalnie | `Claude-Aura-Setup-v<version>-UNSIGNED.exe` wraz z jego `.sha256` i `.manifest.json` |
| **ZIP + CMD fallback** | Windows ostrzega o niepodpisanym setupie lub go blokuje, albo wolisz czytelne skrypty źródłowe | `claude-aura-v<version>.zip` wraz z jego `.sha256` |

#### Path 1 ??Unsigned Setup

1. W sekcji **Assets** pobierz `-UNSIGNED.exe`, jego `.sha256` i `.manifest.json`. Nie używaj automatycznie generowanych przez GitHub archiwów **Source code**.
2. Porównaj SHA-256 pliku Setup z oboma plikami pomocniczymi. Zatrzymaj się i usuń pobrane pliki, jeśli któraś wartość się różni.
3. Windows nie może zweryfikować publishera tego instalatora, ponieważ deweloper nie ma certyfikatu podpisu kodu. Jeśli Windows ostrzega lub blokuje go, nie omijaj ostrzeżenia; użyj Ścieżki 2.
4. Jeśli otwiera się normalnie, postępuj zgodnie z instrukcjami Setup. Sprawdza Node.js i WebView2, instaluje w `%LOCALAPPDATA%\ClaudeAura`, dodaje rejestrację **Installed apps** i skróty, a następnie otwiera Aura.

#### Path 2 ??ZIP + CMD fallback

1. W sekcji **Assets** pobierz `claude-aura-v<version>.zip` i odpowiadający mu `.sha256`. Nie używaj automatycznie generowanych przez GitHub archiwów **Source code**.
2. Porównaj SHA-256 pliku ZIP z plikiem towarzyszącym. Zatrzymaj się i usuń oba pliki, jeśli wartości się różnią.
3. Wybierz **Extract all**. W wyodrębnionym katalogu `claude-aura` kliknij dwukrotnie **Install Claude Aura.cmd**. Nie uruchamiaj go z podglądu ZIP.
4. Czytelny instalator CMD/PowerShell sprawdza Node.js i WebView2, instaluje Aura, tworzy skróty i otwiera aplikację. Ta ścieżka nie ma tożsamości publishera Authenticode i nie dodaje wpisu **Installed apps**.

Po wybraniu dowolnej ścieżki zaloguj się w Aura, jeśli `claude.ai` o to poprosi. Kliknij pływający przycisk Aura, wybierz **Open Studio**, a następnie **Themes**.

Asset o nazwie `Claude-Aura-Setup-v<version>.exe` bez `-UNSIGNED` to inna, podpisana ścieżka i powinien pokazywać publisher wymieniony w uwagach tego wydania. Asset kończący się na `-UNSIGNED-DEV.exe` nigdy nie jest publiczny.

Instalacja nie nakłada patcha ani nie zastępuje Claude Desktop.

<details>
<summary><strong>Installer behavior, application location, and uninstall</strong></summary>

Obie ścieżki działają bez monitu administratora, walidują wymagania wstępne i wykonują chroniony app-tree swap Aury. Pliki aplikacji są instalowane do:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Tworzy skróty **Claude Aura**, **Claude Aura Studio** oraz dezinstalacji w menu Start i na pulpicie. Ustawienia motywów i dane logowania przechowywane są osobno od aplikacji, więc ponowna instalacja Aura nie zastępuje ich po cichu. Natywny Setup dodaje wpis **Installed apps** oraz natywny uninstaller; ścieżka ZIP/CMD zachowuje własny skrót deinstalacji ze skryptu źródłowego.

Deweloperzy mogą sklonować repozytorium i zbudować wyraźnie nazwany unsigned development installer do lokalnej inspekcji. Różni się on od jasno oznaczonego publicznego unsigned Setup. Polecenia build, pinned compiler, bramki weryfikacji i checklistę wydania opisano w
[Windows installer guide](../docs/WINDOWS_INSTALLER.md).

### Uninstall

Najpierw kliknij prawym przyciskiem pływający przycisk Aura i wybierz **Exit Claude Aura**.
W przypadku instalacji ZIP otwórz **Start > Claude Aura > Uninstall Claude Aura** albo kliknij dwukrotnie **Uninstall Claude Aura.cmd** w wypakowanej wersji. Dla obu natywnych Setup możesz też użyć **Settings > Apps > Installed apps > Claude Aura > Uninstall**. Wpis `.cmd` deleguje do zarejestrowanego natywnego uninstalatora, gdy istnieje. Uninstaller odmawia kontynuacji, gdy Aura jest jeszcze otwarte.

Domyślnie odinstalowanie usuwa aplikację Aura i skróty, ale zachowuje lokalne ustawienia motywu i oddzielny profil logowania WebView Aura do późniejszej ponownej instalacji. Uninstaller pyta również przed usunięciem tych folderów. To opcjonalne usunięcie usuwa lokalną sesję logowania Aura; nigdy nie usuwa Claude Desktop, konta Anthropic użytkownika ani danych konta po stronie serwera.

</details>

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>

<a id="theme-showcase"></a>
## Przegląd motywów

System wizualny Aura jest pokazany niżej jako odwołania do widoków New chat i Conversation.
Wyróżniony motyw Japanese Film Editorial New chat znajduje się na górze tego README.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

### Japanese Film Editorial

Ciepły papier, węgiel, przytłumione indygo i powściągliwe wermeonie.

<details>
<summary>Zobacz widok Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>Ciemny · Conversation · pokaz dokumentacyjny dostarczony przez użytkownika</sub>
</p>

</details>

### Japanese Idol

Ciepła kremowość, rumieniec, róż i perłowy liliowy akcent oraz delikatne wstążki.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>Jasny · Nowa rozmowa · pokaz dokumentacyjny dostarczony przez użytkownika</sub>
</p>

<details>
<summary>Zobacz widok Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>Jasny · Conversation · pokaz dokumentacyjny dostarczony przez użytkownika</sub>
</p>

</details>

### Korean Idol

Chłodna biel, periwinkle, holograficzny srebrny połysk i uporządkowane szkło muzyczne.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>Jasny · Nowa rozmowa · pokaz dokumentacyjny dostarczony przez użytkownika</sub>
</p>

<details>
<summary>Zobacz widok Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>Jasny · Conversation · pokaz dokumentacyjny dostarczony przez użytkownika</sub>
</p>

</details>

<details>
<summary><strong>Status referencyjny i granice ponownego użycia</strong></summary>

> **Status referencyjny:** Te obrazy dostarczone przez użytkownika przekazują pożądany kierunek
> wizualny. Mogą zawierać ilustracyjny materiał interfejsowy i nie stanowią dowodu bieżącego
> zachowania `claude.ai` ani dowodu akceptacji na żywo. Nie są tłem motywu,
> nie mogą być importowane do Aura i są wykluczone z instalatorów wydawniczych.
>
> Podglądy zawierają UI produktów stron trzecich, nazwy lub znaki, a także grafikę o
> ludzkiej charakterystyce. Sama ich obecność nie daje praw do ponownego użycia.
> Przed dalszym udostępnianiem lub rozpowszechnianiem potwierdź zastosowanie praw
> do interfejsu, znaków, grafiki i wizerunku.

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>Wszystkie wbudowane motywy i stabilne identyfikatory</strong></summary>

Aura zawiera osiem wbudowanych motywów w stabilnej kolejności:

| # | Motyw | Stabilny ID |
| ---: | --- | --- |
| 1 | Default | `default` |
| 2 | Japanese Film Editorial | `japanese-film-editorial` |
| 3 | Korean Prestige | `korean-prestige` |
| 4 | Cartoon Studio | `cartoon-studio` |
| 5 | Anime Twilight | `anime-twilight` |
| 6 | Study Library | `study-library` |
| 7 | Japanese Idol | `japanese-idol` |
| 8 | Korean Idol | `korean-idol` |

Wbudowane motywy są tylko do odczytu. Studio tworzy edytowalną kopię, gdy chcesz je dostosować.

</details>

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>

<a id="use-aura"></a>
## Korzystanie z Aura

| Akcja | Co robi |
| --- | --- |
| Kliknij pływający przycisk Aura | Otwiera Claude Aura Studio |
| **Themes** | Otwiera wbudowaną galerię i zapisuje wybrany motyw |
| **Create a theme** | Tworzy lub edytuje niestandardowy motyw należący do Aura |
| **Personal wallpaper > Choose wallpaper** | Wybiera lokalny obraz niezależnie od aktywnego motywu |
| **Clear wallpaper** | Przestaje używać tapety bez usuwania jej pliku źródłowego |
| **Original look** | Usuwa stylowanie Aura i pokazuje live site bez wybranego motywu |
| **Apply theme** | Przywraca zapisany motyw Aura po ustawieniu Original look |
| **Open desktop app** | Otwiera Claude Desktop bez modyfikacji go |

Wybrany motyw jest zachowywany między uruchomieniami Aura. **Original look** wyłącza warstwę prezentacji Aura;
nie usuwa zapisanych motywów ani niestandardowej grafiki.
**Default** to pierwszy wbudowany motyw Aura — nie jest to to samo co Original look.

Pływający launcher Aura pozostaje kompaktowym, kolistym sterowaniem. Kliknij, aby otworzyć Studio,
przeciągnij, aby przesunąć, lub kliknij prawym przyciskiem, by otworzyć menu Aura.

Personalizacja tapety pozostaje powiązana z oryginalną ścieżką obrazu. Przeniesienie lub usunięcie
tego pliku sprawi, że tapeta stanie się niedostępna. Grafika importowana przez edytor korzysta
z innej ścieżki: Studio kopiuje lub konwertuje ją do folderów motywów należących do Aura.

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>

<a id="create-a-custom-theme"></a>
## Tworzenie własnego motywu

1. Otwórz **Claude Aura Studio** z Pulpitu lub menu Start.
2. Otwórz **Create a theme** i wybierz **Customize Default**, lub otwórz **Themes**,
   wybierz wbudowany i kliknij **Duplicate to customize**.
3. Dostosuj kolory Light i Dark, typografię, kształty, efekty i grafikę lokalną.
4. Sprawdź układy New chat i Conversation w podglądzie Studio.
5. Rozwiąż ewentualne ostrzeżenia dotyczące kontrastu lub rozmiaru plików.
6. Kliknij **Save theme**.

Pliki wbudowane nigdy nie są nadpisywane. Jeśli wersja robocza jest niepoprawna, pozostaje
edytowalna, a Aura nadal wyświetla ostatnią poprawną wersję.

Importowane pliki PNG, JPEG, WebP lub AVIF są lokalnie konwertowane do zasobów WebP
w ramach limitów. Studio nie przechowuje ścieżki pliku źródłowego w samym motywie. Pełne
szczegóły edytora i kontrakt motywu znajdziesz w [Theme Kit Specification](../docs/THEME_KIT_SPEC.md).

Gdy to możliwe, Studio może użyć zrzutu aktualnego okna Aura jako tła edytora. Taki zrzut
może zawierać treść konwersacji, pozostaje tylko w pamięci bieżącej sesji edycji
i nigdy nie jest zapisywany na dysk.

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>

<a id="built-with"></a>
## Jak działa Aura

| Element | Zastosowanie |
| --- | --- |
| Windows PowerShell i WinForms | Instalator, okno Aura, Studio, skróty i lokalne sterowanie |
| Microsoft Edge WebView2 | Wyświetla rzeczywistą stronę `claude.ai` |
| Node.js 22+ | Waliduje motywy i buduje lokalny styl |
| Lokalne HTML, CSS, JavaScript, SVG i WebP | Dostarcza stylowanie Aura i zasoby wbudowanych motywów |

Projekt nie ma zależności npm runtime ani zewnętrznych czcionek.

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>

<a id="safety-and-privacy"></a>
## Bezpieczeństwo i prywatność

- Aura ładuje rzeczywistą stronę HTTPS `claude.ai` w Microsoft Edge WebView2.
- Strony dostawców logowania nie są stylowane.
- Aura nie otwiera portu zdalnego debugowania ani nie patchuje Claude Desktop.
- Pliki motywów i importowana grafika pozostają w lokalnych folderach należących do Aura.
- Strona live łączy się z Anthropic normalnie.
- Profil WebView zawiera dane sesji logowania i musi być chroniony.
- Podglądy live-page ze Studio pozostają w pamięci tylko na czas sesji edycji i nie
  są zapisywane na dysk.
- Nie wybieraj czułych obrazów w tle; żywa strona technicznie może uzyskiwać dostęp do danych
  DOM we własnym procesie.
- Korzystanie z usługi live wciąż podlega aktualnym
  [Consumer Terms](https://www.anthropic.com/terms)
  i [Usage Policy](https://www.anthropic.com/legal/aup) Anthropic.

Przeczytaj [SECURITY.md](./SECURITY.md) by poznać granice zaufania oraz
[Troubleshooting](../docs/TROUBLESHOOTING.md) by uzyskać pomoc dotyczącą logowania,
ładowania, motywu, obrazu i WebView2.

<a id="local-data"></a>
<details>
<summary><strong>Lokalne foldery danych i zachowanie przy deinstalacji</strong></summary>

Aura oddziela aplikację, ustawienia, motywy, szkice i profil przeglądarki:

| Ścieżka | Zawartość |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Zainstalowana aplikacja Aura |
| `%LOCALAPPDATA%\ClaudeAura\data` | Ustawienia, logi i lokalny stan należący do Aura |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Zapisane motywy niestandardowe i wyprowadzone grafiki |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Trwające szkice w Studio |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Oddzielny profil logowania WebView2 Aura |

Traktuj folder `webview` jak każde zalogowane środowisko przeglądarki. Nie publikuj i nie
udostępniaj go. Domyślna deinstalacja zachowuje `data` i `webview`; ręczne usunięcie
wybierz tylko wtedy, gdy chcesz także wyczyścić lokalne ustawienia, motywy oraz
oddzielny profil logowania.

</details>

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>

<a id="roadmap"></a>
## Plan rozwoju

- [x] Dedykowany towarzysz WebView2 dla Windows i odwracalny **Original look**
- [x] Osiem stabilnych wbudowanych motywów z obsługą Light i Dark
- [ ] **P0** Dokończenie i zatwierdzenie Aura Code do oficjalnego Remote Control lokalnego Claude Code,
  z odpowiadającym eksportem terminal-theme
- [ ] Zakończenie i przegląd wizualnego edytora Studio bez kodu
- [ ] Opublikowanie 30-minutowego samouczka tworzenia własnego motywu
- [ ] Przeprowadzenie końcowego przeglądu weryfikacji wydania

Zobacz [implementation report](../docs/IMPLEMENTATION_REPORT.md) i
[issues repozytorium](https://github.com/kaihuang1425/claude-aura/issues) by śledzić
status publiczny. Podgląd referencyjny nigdy nie zastępuje wymaganego dowodu akceptacji
na żywo.

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>

<a id="support"></a>
## Wsparcie i dokumentacja

Zacznij od [Troubleshooting](../docs/TROUBLESHOOTING.md). W przypadku buga lub wniosku
o funkcję użyj
[Issues repozytorium](https://github.com/kaihuang1425/claude-aura/issues).

Przy zgłaszaniu buga podaj wersję Windows, Node.js i WebView2, aktywny identyfikator motywu
oraz kroki odtworzenia problemu. Przejrzyj logi przed ich udostępnieniem; log UI Aura
jest zapisany w:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Problemy bezpieczeństwa zgłaszaj przez prywatne advisory w repozytorium, zgodnie z
[SECURITY.md](./SECURITY.md).

### Mapa dokumentacji

- [Troubleshooting](../docs/TROUBLESHOOTING.md)
- [Bezpieczeństwo i granice zaufania](./SECURITY.md)
- [Przewodnik tematów](../docs/THEMING.md)
- [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)
- [Implementation report](../docs/IMPLEMENTATION_REPORT.md)
- [File Manifest](../docs/FILE_MANIFEST.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Issues repozytorium](https://github.com/kaihuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>Kontrola wkładów i granice projektu</strong></summary>

Przed wysłaniem zmian uruchom wymagane kontrole:

```powershell
npm run check
npm run verify:cycle
```

Dla pojedynczej weryfikacji wbudowanego motywu:

```powershell
node scripts/theme-cli.mjs qa <id>
```

Zachowaj niezmienione te granice projektu:

- Nie dodawaj zależności npm ani zależności fontów runtime.
- Zachowaj osiem stabilnych identyfikatorów motywów i ich kolejność.
- Nie dystrybuuj odtworzonego HTML interfejsu Claude jako treści produktu.
- Nie dołączaj obrazów referencyjnych jako dowodów akceptacji UI.
- Dołącz źródło, licencję i informacje o dystrybucji dla dostarczanych mediów.

Przed zmianami systemu motywów lub drzewa wydania przeczytaj
[CONTRIBUTING.md](./CONTRIBUTING.md), [Theming guide](../docs/THEMING.md),
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md) i [File Manifest](../docs/FILE_MANIFEST.md).

</details>

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>

<a id="charitable-support"></a>
## Wsparcie charytatywne

Claude Aura nie przyjmuje prywatnych darowizn, napiwków, sponsorowania, opłat referencyjnych
ani innego wsparcia finansowego. Właściciel obecnie przebywa w Zjednoczonym Królestwie
w ramach [warunków Student route](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student),
które zakazują samozatrudnienia i działalności gospodarczej z nielicznymi wyjątkami.
Aby uniknąć potencjalnego konfliktu z tymi warunkami, właściciel nie może przyjmować
darowizn ani napiwków związanych z projektem, gdy te zasady obowiązują.

[Jeśli Claude Aura jest dla Ciebie przydatny, najprostszym, bezkosztowym sposobem wsparcia jest dodanie gwiazdki do repozytorium na GitHub.](https://github.com/kaihuang1425/claude-aura)

<details>
<summary><strong>Kontekst student-route, organizacje non-profit i granice darowizn</strong></summary>

Osoby chcące wspierać pokrewne działania w interesie publicznym mogą darować bezpośrednio
do niezależnych organizacji non-profit:

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  wspiera osoby dotknięte konfliktem i katastrofami, w tym uchodźców odbudowujących
  życie w Wielkiej Brytanii. Szersza sieć IRC uczestniczy również w Claude Corps.
- [CodePath](https://www.every.org/codepath) oferuje bezpłatne szkolenia techniczne
  i współpracuje z Anthropic jako partner non-profit dla
  [Claude Corps](https://www.anthropic.com/news/claude-corps).

Powyższe linki prowadzą bezpośrednio do stron stron trzecich. Claude Aura i jej właściciel
nie pobierają, nie przetwarzają, nie kontrolują, nie otrzymują ani nie odnoszą korzyści
finansowych z żadnej darowizny. Organizacje same obsługują przetwarzanie darów i rachunki.
Ich wymienianie nie oznacza powiązania, sponsoringu, aprobaty ani oficjalnej współpracy
fundraisingowej z Claude Aura.

</details>

<a id="license-and-notices"></a>
## Licencja i uwagi

Oprogramowanie tworzone przez projekt jest rozpowszechniane na licencji
[MIT License](./LICENSE). Przeczytaj też [NOTICE.md](./NOTICE.md)
i [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

Licencja MIT nie przyznaje praw do nazw, znaków, interfejsu, strony internetowej ani aplikacji
Anthropic. Napisy w podglądzie nie dają praw do ponownego użycia widocznego UI, grafiki,
 nazw, znaków ani rozpoznawalnych wizerunków osób. Obowiązują nadal dokumenty źródłowe
i prawne dla poszczególnych plików.

Zapoznaj się z aktualną
[Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
i [Consumer Terms](https://www.anthropic.com/terms). Przed publikacją, modyfikacją lub
ponowną dystrybucją chronionych nazw, znaków, zrzutów interfejsu, grafiki lub
rozpoznawalnych wizerunków pobierz wymagane zezwolenie od odpowiedniego właściciela praw.
To repozytorium i ten README nie udzielają takiego uprawnienia.

<a id="acknowledgments"></a>
## Podziękowania

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) wpłynął na pierwotny
  workflow walidacji loopback oraz przystępny wzorzec showcase.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin)
  wpłynęło na wczesne mapowanie semantyki motywu.
- [Best README Template](https://github.com/othneildrew/Best-README-Template)
  wpłynęło na strukturę README nastawioną na czytelnika.
- Microsoft Edge WebView2 dostarcza runtime wbudowanej przeglądarki.

Szczegółowe licencje i pochodzenie plików znajdują się w
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). Uznanie wkładu nie oznacza
powiązania, sponsoringu ani rekomendacji.

<p align="right">(<a href="#readme-top">powrót na początek</a>)</p>
