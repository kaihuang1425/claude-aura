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
  <strong>日本語</strong> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.pt-BR.md">Português (Brasil)</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.it.md">Italiano</a> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Windows でリアルな Claude サイトに、ローカルで可逆な個人用テーマを付与します。</strong><br>
  ローカルテーマ · Claude Desktop のパッチなし · 1 クリックで元の外観へ戻る
</p>

<p align="center">
  <a href="#getting-started">はじめに</a> ·
  <a href="#theme-showcase">テーマを見る</a> ·
  <a href="#create-a-custom-theme">テーマを作成</a> ·
  <a href="../docs/TROUBLESHOOTING.md">トラブルシューティング</a> ·
  <a href="../SECURITY.md">セキュリティ</a>
</p>

<p align="center">
  <a href="https://github.com/kaihuang1425/claude-aura"><strong>Claude Aura があなたに役立つなら、GitHub でこのプロジェクトにスターを付けてください。</strong></a>
</p>

<p align="center">
  <a href="../README.md#feature-tour"><img src="../docs/readme-showcase/actual-work-hub-tabs.png"
       alt="Claude Aura Dashboard, tabs, pet, and themes feature tour"
       width="900"></a><br>
  <sub>Actual installed Aura capture · Themes · Pet · Tabs · Dashboard</sub>
</p>


> **Independent project.** Claude Aura は独立プロジェクトであり、Anthropic PBC と提携・後援・スポンサー・承認を受けていません。Aura は `claude.ai` のライブサイトを表示しますが、Claude や Anthropic のインストール済みアプリを提供・変更しません。Claude、Anthropic、および関連する名称・商標は Anthropic PBC のものです。プロジェクトのライセンスはこれらの素材に対する権利を付与しません。

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
<summary><strong>目次</strong></summary>

- [Claude Aura](#claude-aura)
  - [Aura の理由](#why-aura)
  - [クイックスタート](#quick-start)
    - [必要要件](#requirements)
    - [インストール](#installation)
    - [アンインストール](#uninstall)
  - [テーマのショーケース](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Aura を使用する](#use-aura)
  - [カスタムテーマの作成](#create-a-custom-theme)
  - [Aura のしくみ](#how-aura-works)
  - [安全性とプライバシー](#safety-and-privacy)
  - [ロードマップ](#roadmap)
  - [サポートとドキュメント](#support-and-documentation)
    - [ドキュメントマップ](#documentation-map)
  - [慈善支援](#charitable-support)
  - [ライセンスと通知](#license-and-notices)
  - [謝辞](#acknowledgments)

</details>
<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Aura の理由

- **ライブの Claude サイトを使用します。** Aura は実際の UI とネイティブコントロールを維持し、再構成したスクリーンへ置き換えません。
- **変更をローカルかつ可逆に保ちます。** Claude Desktop をパッチせずにローカルスタイルを適用し、**Original look** で Aura のプレゼンテーションレイヤーを 1 回のクリックで除去します。
- **8 つの組み込みテーマから開始。** それぞれ安定した読み取り専用の開始点として利用できます。
- **元のテーマを上書きせずにテーマ作成。** Claude Aura Studio はローカル色、タイポグラフィ、シェイプ、効果、アートワークをサポートします。

Aura 0.3 は現在ライブのサイトに対してのみテーマを適用します。まだネイティブの Claude Desktop Code や Claude Code ターミナルには対応しておらず、Aura 内の通常チャットはローカルプロジェクトアクセスを取得しません。最終リリース前に、Aura Code はライブ `claude.ai/code` 上の公式
[Remote Control](https://code.claude.com/docs/en/remote-control) セッションでリリース阻止チェックを通過し、
対応する terminal-theme export がローカル限定環境で Claude Desktop をパッチせずに適用される必要があります。

<details>
<summary><strong>機能一覧と除外内容</strong></summary>

Claude Aura は実際の `claude.ai` サイトを専用の Microsoft Edge
WebView2 ウィンドウで開き、ローカルの視覚テーマを適用します。これは、Claude Desktop を
パッチせずに、スクリーンショットに置き換えるのではなく、よりパーソナルな
ワークスペースを求める方向けの設計です。

| Aura が行うこと | Aura が行わないこと |
| --- | --- |
| WebView2 でライブ `claude.ai` インターフェースを読み込む | 再構成したインターフェースで Claude を置き換える |
| 可逆なローカルスタイルを適用する | Claude Desktop、`app.asar`、Windows パッケージ、コード署名をパッチする |
| 8 つの組み込みテーマを提供 | Claude アカウント、チャット、API キー、モデル、プロバイダ設定を変更する |
| ローカルのカスタムテーマ用に Studio を提供 | Anthropic 製品または公式テーマシステムを名乗る |
| アプリ内に **Original look** を提供 | スタイル無効時に保存済みテーマを削除する |

</details>

<p align="right">(<a href="#readme-top">先頭へ戻る</a>)</p>
<a id="getting-started"></a>
## クイックスタート

<a id="requirements"></a>
### 必要要件

- Windows 10 または Windows 11
- インターネットアクセスと Claude アカウント
- [Node.js 22 以上](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 はほぼすべての最新 Windows で利用できます。Aura がブラウザーウィンドウを開けない場合は
Evergreen WebView2 Runtime をインストールまたは修復して再試行してください。Claude Desktop は任意で、別アプリとして残ります。

<a id="installation"></a>
### インストール

[最新リリース](https://github.com/kaihuang1425/claude-aura/releases)を開き、これらのいずれかのパスを選択します。どちらも現在のWindowsアカウントに同じバージョンをインストールします。

| Path | Use it when | Download |
| --- | --- | --- |
| **Unsigned Setup** | より簡単なガイド付きインストーラーを希望し、Windowsが通常通り開く場合 | `Claude-Aura-Setup-v<version>-UNSIGNED.exe` とそれに対応する `.sha256`、`.manifest.json` |
| **ZIP + CMD fallback** | Windowsがunsigned Setupを警告またはブロックする場合、または読み取り可能なソーススクリプトを希望する場合 | `claude-aura-v<version>.zip` とそれに対応する `.sha256` |

#### Path 1 ??Unsigned Setup

1. **Assets** から `-UNSIGNED.exe`、その `.sha256`、および `.manifest.json` をダウンロードします。GitHubが自動生成する **Source code** アーカイブは使用しないでください。
2. SetupファイルのSHA-256を、companionファイルの両方と比較します。いずれかの値が異なる場合は、ダウンロードを停止して両方のファイルを削除します。
3. 開発者はコード署名証明書を持っていないため、Windowsはこのインストーラーのpublisherを検証できません。Windowsが警告を出すかブロックした場合は、回避せずPath 2を使用してください。
4. 正常に開いた場合はSetupに従ってください。Node.jsとWebView2をチェックし、`%LOCALAPPDATA%\ClaudeAura` 配下へコピー、**Installed apps**の登録とショートカットを追加し、その後Auraを開きます。

#### Path 2 ??ZIP + CMD fallback

1. **Assets** から `claude-aura-v<version>.zip` と対応する `.sha256` をダウンロードします。GitHubが自動生成する **Source code** アーカイブは使用しないでください。
2. ZIPのSHA-256をcompanionファイルと比較します。値が異なる場合は、停止して両方のファイルを削除します。
3. **Extract all** を選択します。展開された `claude-aura` フォルダーで **Install Claude Aura.cmd** をダブルクリックします。ZIPプレビュー内からは実行しないでください。
4. 読み取り可能なCMD/PowerShellインストーラーはNode.jsとWebView2をチェックし、Auraをインストール、ショートカットを作成して開きます。このパスにはAuthenticode publisher identityはなく、**Installed apps**エントリは追加されません。

どちらのパスでも、`claude.ai` が要求した場合はAura内でサインインしてください。フローティングAuraボタンをクリックし、**Open Studio**、続いて **Themes** を選択します。

`-UNSIGNED` を含まない `Claude-Aura-Setup-v<version>.exe` は別のsigned pathで、このリリースノートで名前付きのpublisherを表示する必要があります。`-UNSIGNED-DEV.exe` で終わるassetは決して公開されません。

インストールはClaude Desktopをパッチ適用または置換しません。

<details>
<summary><strong>Installer behavior, application location, and uninstall</strong></summary>

両パスとも管理者プロンプトなしで実行され、前提条件を検証し、Auraの保護付きapp-tree swapを実行します。アプリケーションファイルは以下にインストールされます。

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Startメニューとデスクトップに **Claude Aura**、**Claude Aura Studio**、およびアンインストールショートカットを作成します。テーマ設定とサインインデータはアプリケーションとは別に保存されるため、Auraを再インストールしても静かに置換されません。ネイティブSetupは **Installed apps** エントリとネイティブアンインストーラーを追加しますが、ZIP/CMDパスはそのソーススクリプトのアンインストールショートカットを保持します。

開発者はリポジトリをクローンし、ローカル検査用に明示的に命名されたunsigned development installerをビルドできます。これは明確に区別された公開のunsigned Setupとは異なります。ビルドコマンド、pinnedコンパイラ、検証ゲート、およびrelease checklistは
[Windows installer guide](../docs/WINDOWS_INSTALLER.md) に文書化されています。

### Uninstall

まず、フローティングAuraボタンを右クリックし、**Exit Claude Aura** を選択します。
ZIPインストールでは、**Start > Claude Aura > Uninstall Claude Aura** を開くか、展開したrelease内の **Uninstall Claude Aura.cmd** をダブルクリックします。どちらのnative Setupでも、**Settings > Apps > Installed apps > Claude Aura > Uninstall** も使用できます。`.cmd`エントリは、存在する場合、登録済みのnative uninstallerに委任します。uninstallerはAuraがまだ開いている間は継続しません。

デフォルトではアンインストールによりAuraアプリケーションとショートカットが削除されますが、ローカルのテーマ設定とAuraの別個のWebViewサインインプロファイルは、後で再インストールするために保持されます。uninstallerはこれらのフォルダーを削除する前にも確認します。このオプションの消去によりAuraのローカルサインインセッションが削除されます。これはClaude Desktop、ユーザーのAnthropicアカウント、またはサーバー側のアカウントデータを削除しません。

</details>
<p align="right">(<a href="#readme-top">先頭へ戻る</a>)</p>

<a id="theme-showcase"></a>
## テーマのショーケース

Aura のビジュアルシステムは New chat と Conversation の参照で示します。
README 冒頭にある Japanese Film Editorial New chat のプレビューが主な例です。

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

<a id="japanese-film-editorial"></a>
### Japanese Film Editorial

温かみのある紙質、チャコールインク、抑えたインディゴ、控えめなバーミリオン。

<details>
<summary>Conversation view を表示</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>ダーク · Conversation · 利用者提供のドキュメントショーケース</sub>
</p>

</details>

<a id="japanese-idol"></a>
### Japanese Idol

温かいクリーム、ブラッシュ、ローズ、パールのようなラベンダー、繊細なリボンの装飾。

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>ライト · New chat · 利用者提供のドキュメントショーケース</sub>
</p>

<details>
<summary>Conversation view を表示</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>ライト · Conversation · 利用者提供のドキュメントショーケース</sub>
</p>

</details>

<a id="korean-idol"></a>
### Korean Idol

クールホワイト、ペリウィンクル、ホログラフィックシルバー、構造化されたミュージックガラス。

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>ライト · New chat · 利用者提供のドキュメントショーケース</sub>
</p>

<details>
<summary>Conversation view を表示</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>ライト · Conversation · 利用者提供のドキュメントショーケース</sub>
</p>

</details>

<details>
<summary><strong>参照ステータスと再利用の範囲</strong></summary>

> **参照ステータス:** これらのユーザー提供画像は想定される視覚方向を示します。
> 例示的なインターフェース内容を含む場合があり、ライブ受け入れ証拠や現在の
> `claude.ai` の挙動を示す証明ではありません。テーマ背景としての配布、Aura へのインポートは禁止です。
> これらの画像はリリースインストーラーから除外されています。
>
> なお、プレビューには第三者の製品 UI、名前・商標、または人間的肖像アートが含まれる場合があります。
> これらの掲載は再利用権を与えるものではありません。公開・再配布前に、該当する
> インターフェース、商標、アート、肖像権の権利確認を行ってください。

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>組み込みテーマと安定 ID</strong></summary>

Aura は順番固定の 8 組み込みテーマを提供します:

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

組み込みテーマは読み取り専用です。Studio でテーマをカスタマイズすると、編集可能なコピーが作成されます。

</details>

<p align="right">(<a href="#readme-top">先頭へ戻る</a>)</p>
<a id="use-aura"></a>
## Aura を使用する

| アクション | 説明 |
| --- | --- |
| フローティングの Aura ボタンをクリック | Claude Aura Studio を開きます |
| **Themes** | 組み込みギャラリーを開き、選択テーマを保存 |
| **Create a theme** | Aura 所有のカスタムテーマを作成/編集 |
| **Personal wallpaper > Choose wallpaper*** | 現在のテーマとは別にローカル画像を選択 |
| **Clear wallpaper** | ソースファイルを削除せず壁紙を解除 |
| **Original look** | Aura のスタイリングを解除し、選択テーマなしのライブサイトを表示 |
| **Apply theme** | Original look 後に保存済み Aura テーマを再適用 |
| **Open desktop app** | Claude Desktop を変更せずに開く |

選択テーマは Aura 再起動後も維持されます。**Original look** は Aura のプレゼンテーション層を無効化するだけで、保存済みテーマやカスタムアートワークは削除しません。
**Default** は Aura の最初の組み込みテーマであり、Original look とは異なります。

フローティングの Aura ランチャーは小さな円形コントロールのままです。クリックで Studio を開き、ドラッグで移動し、右クリックで Aura メニューを表示します。

Personal wallpaper は元画像パスにリンクしたままです。画像を移動または削除すると壁紙は利用不可になります。エディター経由のテーマアートは別ルートで保存され、Studio が Aura 専有のテーマフォルダーにコピーまたは変換します。

<p align="right">(<a href="#readme-top">先頭へ戻る</a>)</p>

<a id="create-a-custom-theme"></a>
## カスタムテーマの作成

1. デスクトップまたはスタートメニューから **Claude Aura Studio** を開きます。
2. **Create a theme** を開き、**Customize Default** を選択するか、**Themes** から組み込みテーマを選んで **Duplicate to customize** を選びます。
3. Light と Dark の色、タイポグラフィ、シェイプ、効果、ローカルアートワークを調整します。
4. Studio のプレビューで New chat と Conversation レイアウトを確認します。
5. コントラスト警告やファイルサイズ警告を解消します。
6. **Save theme** を選択します。

組み込みファイルは上書きされません。ドラフトが無効になっても、Aura は最終の有効バージョンを表示し続け、ドラフト編集は可能です。

インポートした PNG、JPEG、WebP、AVIF アートワークはローカルで予算付き WebP アセットへ変換されます。Studio はテーマ内に元ファイルパスを保存しません。詳細なエディターとテーマ仕様は
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md) を参照してください。

利用可能な場合、Studio は実際の Aura ウィンドウのキャプチャを編集背景として使用できます。
このキャプチャには会話内容が含まれることがあり、現在の編集セッションのメモリ内のみで保持され、ディスクへ書き込まれません。

<p align="right">(<a href="#readme-top">先頭へ戻る</a>)</p>

<a id="built-with"></a>
<a id="how-aura-works"></a>
## Aura のしくみ

| パーツ | 役割 |
| --- | --- |
| Windows PowerShell と WinForms | インストーラー、Aura ウィンドウ、Studio、ショートカット、ローカルコントロール |
| Microsoft Edge WebView2 | 実際の `claude.ai` サイトを表示 |
| Node.js 22+ | テーマ検証とローカルテーマスタイルの構築 |
| Local HTML、CSS、JavaScript、SVG、WebP | Aura スタイリングと組み込みテーマ資産を提供 |

本プロジェクトには npm パッケージやランタイムフォントの外部依存はありません。

<p align="right">(<a href="#readme-top">先頭へ戻る</a>)

<a id="safety-and-privacy"></a>
## セキュリティとプライバシー

- Aura は Microsoft Edge WebView2 で実際の HTTPS `claude.ai` を読み込みます。
- サインインプロバイダーのページはテーマを適用しません。
- Aura はリモートデバッグポートを開かず、Claude Desktop もパッチしません。
- テーマファイルとインポート画像は Aura 管理のローカルフォルダーに保存されます。
- ライブページは通常通り Anthropic へ接続します。
- WebView プロファイルにはサインインセッションデータが含まれるため、保護が必要です。
- Studio live-page captures は編集中セッションのメモリ内のみで保持され、ディスク保存されません。
- 機密性の高い背景画像は選択しないでください。ライブページは技術的には自身のプロセス内 DOM データにアクセスできます。
- ライブサービスの利用は Anthropic の現行 [Consumer Terms](https://www.anthropic.com/terms) と [Usage Policy](https://www.anthropic.com/legal/aup) に従います。

信頼境界については [SECURITY.md](./SECURITY.md) を、サインイン・読み込み・テーマ・画像・WebView2 のヘルプは [Troubleshooting](../docs/TROUBLESHOOTING.md) を参照してください。

<a id="local-data"></a>
<details>
<summary><strong>ローカルデータフォルダーとアンインストール保持</strong></summary>

Aura はアプリ、設定、テーマ、下書き、ブラウザープロファイルを分離して管理します。

| パス | 内容 |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | インストール済み Aura アプリ |
| `%LOCALAPPDATA%\ClaudeAura\data` | 設定、ログ、Aura 専有のローカル状態 |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | 保存済みのカスタムテーマと派生アート |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | 進行中の Studio 下書き |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Aura の独立した WebView2 サインインプロファイル |

`webview` フォルダーは署名済みブラウザープロファイルと同様に扱ってください。公開や共有は行わないでください。既定アンインストールは `data` と `webview` を保持します。これらを消去するのは、ローカル設定、テーマ、独立したサインインプロファイルも削除したい場合のみ行ってください。

</details>

<p align="right">(<a href="#readme-top">先頭へ戻る</a>)</p>
<a id="roadmap"></a>
## ロードマップ

- [x] 専用 Windows WebView2 コンパニオンと可逆的 **Original look**
- [x] Light と Dark 対応の 8 種の安定テーマ
- [ ] ノーコード Studio ビジュアルエディターを完成・レビュー
- [ ] 公式ローカル Claude Code Remote Control 用 Aura Code を、対応するターミナルテーマエクスポート付きで完成・承認
- [ ] 30 分カスタムテーマチュートリアル公開
- [ ] 最終リリース検証スイープの実行

公開状況は [implementation report](../docs/IMPLEMENTATION_REPORT.md) と
[repository issues](https://github.com/kaihuang1425/claude-aura/issues) で確認してください。参照プレビューは、必要なライブ Aura 受け入れ証跡の代替にはなりません。

<p align="right">(<a href="#readme-top">先頭へ戻る</a>)</p>

<a id="support"></a>
## サポートとドキュメント

はじめに [Troubleshooting](../docs/TROUBLESHOOTING.md) から参照してください。
再現可能なバグや機能要求は、
[repository の Issues ページ](https://github.com/kaihuang1425/claude-aura/issues) を使って送信してください。

バグ報告時には、Windows・Node.js・WebView2 のバージョン、アクティブなテーマ ID、
問題再現手順を含めてください。共有前にログを確認してください。Aura の UI ログは以下にあります:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

セキュリティ問題は [SECURITY.md](./SECURITY.md) の説明に従い、リポジトリの private security advisory で報告してください。

<a id="documentation-map"></a>
### ドキュメントマップ

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
<summary><strong>コントリビューションチェックとプロジェクト境界</strong></summary>

送信前に以下の必須チェックを実行してください。

```powershell
npm run check
npm run verify:cycle
```

1 つの組み込みテーマ監査:

```powershell
node scripts/theme-cli.mjs qa <id>
```

以下のプロジェクト境界は維持してください。

- npm やランタイムフォント依存を追加しない
- 8 つの安定テーマ ID と順序を変更しない
- Claude の再構築 UI HTML を製品コンテンツとして配布しない
- 参照画像を UI 受け入れ証跡として提出しない
- 寄稿メディアにはソース、ライセンス、配布情報を含める

テーマシステムやリリースツリーを変更する前に、[CONTRIBUTING.md](./CONTRIBUTING.md),
[Theming guide](../docs/THEMING.md), [Theme Kit Specification](../docs/THEME_KIT_SPEC.md),
[File Manifest](../docs/FILE_MANIFEST.md) を確認してください。

</details>

<p align="right">(<a href="#readme-top">先頭へ戻る</a>)</p>

<a id="charitable-support"></a>
## 慈善支援

Claude Aura は個人的な寄付、チップ、スポンサー、紹介料、その他の金銭的サポートを受け付けません。
所有者は現在、[Student route conditions](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student)
(英国)のもとにあり、限定的な条件を除いて自営業や事業活動は許可されていません。
これらの条件が適用されている間、プロジェクト関連の寄付やチップを受け取ることは
衝突防止のためにできません。

[Claude Aura があなたにとって役立つものであれば、これを支援する最もシンプルで非金銭的な方法は、GitHub のこのリポジトリにスターを付けることです。](https://github.com/kaihuang1425/claude-aura)

<details>
<summary><strong>Student-route の背景、独立非営利団体、寄付の境界</strong></summary>

関連の公共利益活動を支援したい読者は、次の独立非営利団体へ直接寄付できます。

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  は紛争・災害の影響を受けた人々、英国で生活を再建する難民を支援します。より広い
  International Rescue Committee は
  [Claude Corps](https://www.anthropic.com/news/claude-corps) にも参加しています。
- [CodePath](https://www.every.org/codepath) は無料の技術教育を提供し、
  Anthropic の非営利パートナーとして
  [Claude Corps](https://www.anthropic.com/news/claude-corps) と協力します。

これらのリンクは直接サードパーティへ接続します。Claude Aura と所有者は、
寄付の受領・処理・統制・保有から利益を得ることはありません。各団体が寄付の処理と
領収書を管理します。掲載は、Claude Aura との提携・スポンサー・推奨・公式連携を意味しません。

</details>

<a id="license-and-notices"></a>
## ライセンスと通知

プロジェクトで作成されたソフトウェアは [MIT License](./LICENSE) で配布されます。
[NOTICE.md](./NOTICE.md) と [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) もご確認ください。

MIT License は Anthropic の名前、商標、インターフェース、ウェブサイト、またはアプリケーションへの権利を付与しません。
ショーケースのキャプションは、表示 UI、アートワーク、名前、商標、人間の類似性のある描写に対する
再利用権を与えません。ファイル単位のソースおよび権利表示は引き続き有効です。

現在の [Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
と [Consumer Terms](https://www.anthropic.com/terms) を確認してください。表示、修正、再配布する前に、
権利者から必要な許可を得てください。このリポジトリおよび README はそれらの許可を
付与するものではありません。

<a id="acknowledgments"></a>
## 謝辞

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) は初期の loopback 検証フローと
  分かりやすいショーケースパターンに影響を与えました。
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin) は初期セマンティックテーママッピングに影響を与えました。
- [Best README Template](https://github.com/othneildrew/Best-README-Template) はこの README の
  読みやすい構成に影響を与えました。
- Microsoft Edge WebView2 は組み込みブラウザーランタイムを提供します。

詳細なライセンスと provenance は
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) に記録されています。
謝辞は提携、スポンサー、または承認を意味しません。

<p align="right">(<a href="#readme-top">先頭へ戻る</a>)</p>
