<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <strong>繁體中文</strong> ·
  <a href="./README.hi.md">हिंदी</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.fr.md">Français</a> ·
  <a href="./README.id.md">Bahasa Indonesia</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.pt-BR.md">Português (Brasil)</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.it.md">Italiano</a> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>在 Windows 上，替 Claude 即時網站換上個人化、可隨時還原的主題。</strong><br>
  本機主題 · 不修改 Claude Desktop · 一鍵回到原始外觀
</p>

<p align="center">
  <a href="#getting-started">開始使用</a> ·
  <a href="#theme-showcase">瀏覽主題</a> ·
  <a href="#create-a-custom-theme">建立主題</a> ·
  <a href="../docs/TROUBLESHOOTING.md">疑難排解</a> ·
  <a href="./SECURITY.md">安全性</a>
</p>

<p align="center">
  如果 Claude Aura 對你有幫助，歡迎<a href="https://github.com/kaihuang1425/claude-aura"><strong>在 GitHub 上幫專案按個 Star</strong></a>。
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="日系電影編輯風深色新對話參考預覽"
       width="900"><br>
  <sub>深色 · 新對話 · 使用者提供的說明文件展示圖</sub>
</p>

<p align="center"><sub>參考預覽 · 不是可匯入的主題背景，也不是即時驗收證據</sub></p>

> **獨立專案。** Claude Aura 是非官方專案，與 Anthropic PBC 沒有合作、
> 認可、贊助或核准關係。Aura 顯示 `claude.ai` 即時網站；本專案不提供
> Claude 服務，也不會修改 Anthropic 安裝在電腦上的應用程式。Claude、
> Anthropic 和相關名稱及標誌均屬 Anthropic PBC 所有。本專案授權不包含
> 這些素材的任何權利。

<details>
<summary><strong>公開或商業發布的商標說明</strong></summary>

> **公開或商業發布前請留意：** Anthropic 現行的
> [商標使用準則](https://www.anthropic.com/legal/trademark-guidelines)
> 規定，使用其名稱與標誌前必須取得核准，且不得改造標誌。免責聲明不等於
> 取得許可。若發布版本保留 **Claude Aura** 名稱或經主題化的 Claude
> 文字標誌，必須先取得書面許可，並接受適當的法律審查。

</details>

<a id="contents"></a>
<details>
<summary><strong>目錄</strong></summary>

- [Claude Aura](#claude-aura)
  - [為什麼選 Aura](#為什麼選-aura)
  - [開始使用](#開始使用)
    - [系統需求](#系統需求)
    - [安裝](#安裝)
    - [解除安裝](#解除安裝)
  - [主題展示](#主題展示)
    - [日系電影編輯風](#日系電影編輯風)
    - [日系偶像](#日系偶像)
    - [韓系偶像](#韓系偶像)
  - [使用 Aura](#使用-aura)
  - [建立自訂主題](#建立自訂主題)
  - [Aura 如何運作](#aura-如何運作)
  - [安全性與隱私權](#安全性與隱私權)
  - [開發藍圖](#開發藍圖)
  - [支援與說明文件](#支援與說明文件)
    - [說明文件索引](#說明文件索引)
  - [公益支持](#公益支持)
  - [授權與聲明](#授權與聲明)
  - [致謝](#致謝)

</details>

<a id="about-claude-aura"></a>
## 為什麼選 Aura

- **使用 Claude 即時網站。** Aura 保留真正的介面與原生控制項，不會以重建畫面取代它們。
- **變更只留在本機，而且可隨時還原。** Aura 不需要修改 Claude Desktop 就能套用本機樣式；按一下 **原始外觀**，即可移除 Aura 的顯示層。
- **從 8 個內建主題開始。** 每個主題都可作為穩定、唯讀的個人化工作空間起點。
- **建立主題時不覆寫原始檔案。** Claude Aura Studio 支援本機配色、字體、形狀、效果與美術素材。

Aura 0.3 目前只會替即時網站套用主題，還不會替 Claude Desktop 原生 Code
介面或 Claude Code 終端機套用主題；Aura 裡的一般對話也不會因此取得本機專案
存取權。正式發行前，Aura Code 必須完成一項未通過就不得發行的驗證：在即時
`claude.ai/code` 中，透過官方
[Remote Control](https://code.claude.com/docs/en/remote-control) 操作已套用主題的
本機 Claude Code 工作階段；受限環境則以相符的終端機主題匯出作為替代，而且
全程不修改 Claude Desktop。

<details>
<summary><strong>完整功能範圍與限制</strong></summary>

Claude Aura 會在獨立的 Microsoft Edge WebView2 視窗中開啟真正的
`claude.ai` 網站，並套用本機視覺主題。它適合想打造個人化工作空間，
但不想修改 Claude Desktop，也不想以螢幕截圖取代即時介面的人。

| Aura 會做的事 | Aura 不會做的事 |
| --- | --- |
| 在 WebView2 中載入即時 `claude.ai` 介面 | 以重建的介面取代 Claude |
| 套用可還原的本機樣式 | 修改 Claude Desktop、`app.asar`、Windows 套件或程式碼簽章 |
| 提供 8 個內建主題 | 變更 Claude 帳號、對話、API 金鑰、模型或服務提供者設定 |
| 提供 Studio 來建立本機自訂主題 | 宣稱是 Anthropic 產品或官方主題系統 |
| 在應用程式內提供 **原始外觀** | 關閉樣式時刪除已儲存的主題 |

</details>

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

<a id="getting-started"></a>
## 開始使用

### 系統需求

- Windows 10 或 Windows 11
- 網路連線與 Claude 帳號
- [Node.js 22 或更新版本](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

大多數目前使用中的 Windows 電腦都已安裝 WebView2。如果 Aura 無法開啟
瀏覽器視窗，請安裝或修復 Evergreen WebView2 Runtime，然後再試一次。
Claude Desktop 為選用程式，會繼續以獨立應用程式執行。

### 安裝

1. 下載
   [最新發行版 ZIP](https://github.com/kaihuang1425/claude-aura/releases)。
2. 在檔案總管中按 ZIP 檔案右鍵，選擇 **全部解壓縮**。
3. 開啟解壓縮後的資料夾，按兩下 **Install Claude Aura.cmd**。
4. 等待安裝程式關閉並開啟 **Claude Aura** 視窗。
5. 如果 `claude.ai` 要求登入，請直接在 Aura 內完成登入。
6. 按一下浮動的 Aura 按鈕開啟 Studio，再選擇 **主題**。

安裝過程不會修改或取代 Claude Desktop。

<details>
<summary><strong>安裝程式行為、應用程式位置、開發者工作目錄與解除安裝</strong></summary>

這個安裝程式不需要系統管理員權限。它會先執行內建驗證，再將應用程式
檔案複製到：

```text
%LOCALAPPDATA%\ClaudeAura\app
```

安裝程式會在桌面與開始功能表建立 **Claude Aura** 和
**Claude Aura Studio** 捷徑。主題設定與登入資料會和應用程式分開儲存，
因此重新安裝 Aura 時不會在未告知的情況下取代它們。

開發者也可以複製儲存庫，不下載 ZIP，直接從工作目錄執行同一個安裝程式。
從工作目錄安裝時，會先執行完整的儲存庫測試套件。

### 解除安裝

請先在浮動的 Aura 按鈕上按右鍵，選擇 **結束 Claude Aura**。接著開啟
**開始 > Claude Aura > 解除安裝 Claude Aura**，或在解壓縮後的發行版中
按兩下 **Uninstall Claude Aura.cmd**。Aura 仍在執行時，解除安裝程式不會繼續。

解除安裝預設只會移除 Aura 應用程式與捷徑，並保留本機主題設定和 Aura
專用的 WebView 登入設定檔，方便日後重新安裝。解除安裝程式也會先詢問，
再決定是否一併移除這些資料夾。選擇清除後，會移除 Aura 的本機登入工作階段；
不會移除 Claude Desktop、Anthropic 帳號或伺服器端的帳號資料。

</details>

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

<a id="theme-showcase"></a>
## 主題展示

下方以「新對話」與「對話」參考圖呈現 Aura 的視覺系統；本 README 頂端已展示
「日系電影編輯風」的新對話預覽。

**預設 · 日系電影編輯風 · 韓系精品 · 卡通工作室 · 動畫暮光 · 自習圖書館 · 日系偶像 · 韓系偶像**

### 日系電影編輯風

暖色紙張、炭黑墨色、低彩度靛藍與節制的朱紅色。

<details>
<summary>查看對話畫面</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="日系電影編輯風深色對話參考預覽"
       width="900"><br>
  <sub>深色 · 對話 · 使用者提供的說明文件展示圖</sub>
</p>

</details>

### 日系偶像

暖奶油色、柔粉色、玫瑰色、珠光淡紫色與細緻的緞帶細節。

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="日系偶像淺色新對話參考預覽"
       width="900"><br>
  <sub>淺色 · 新對話 · 使用者提供的說明文件展示圖</sub>
</p>

<details>
<summary>查看對話畫面</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="日系偶像淺色對話參考預覽"
       width="900"><br>
  <sub>淺色 · 對話 · 使用者提供的說明文件展示圖</sub>
</p>

</details>

### 韓系偶像

冷白色、長春花藍、全像銀色與層次分明的音樂玻璃質感。

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="韓系偶像淺色新對話參考預覽"
       width="900"><br>
  <sub>淺色 · 新對話 · 使用者提供的說明文件展示圖</sub>
</p>

<details>
<summary>查看對話畫面</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="韓系偶像淺色對話參考預覽"
       width="900"><br>
  <sub>淺色 · 對話 · 使用者提供的說明文件展示圖</sub>
</p>

</details>

<details>
<summary><strong>參考圖狀態與重複使用界線</strong></summary>

> **參考圖說明：** 這些由使用者提供的圖片用來呈現預期的視覺方向。
> 圖片可能含有示意用的介面內容，不是即時驗收證據，也不能證明目前
> `claude.ai` 的實際行為。這些圖片不是主題背景、不得匯入 Aura，且不會
> 包含在發行版安裝程式中。
>
> 預覽圖含有第三方產品介面、名稱或標誌，以及人物肖像風格的美術素材。
> 收錄這些圖片不代表取得重複使用的權利。進一步發布或轉散布前，請先確認
> 適用的介面、商標、美術素材與肖像權利。

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>所有內建主題與固定 ID</strong></summary>

Aura 依固定順序提供 8 個內建主題：

| # | 主題 | 固定 ID |
| ---: | --- | --- |
| 1 | 預設 | `default` |
| 2 | 日系電影編輯風 | `japanese-film-editorial` |
| 3 | 韓系精品 | `korean-prestige` |
| 4 | 卡通工作室 | `cartoon-studio` |
| 5 | 動畫暮光 | `anime-twilight` |
| 6 | 自習圖書館 | `study-library` |
| 7 | 日系偶像 | `japanese-idol` |
| 8 | 韓系偶像 | `korean-idol` |

內建主題為唯讀。想要自訂時，Studio 會建立可編輯的副本。

</details>

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

<a id="use-aura"></a>
## 使用 Aura

| 操作 | 功能 |
| --- | --- |
| 按一下浮動的 Aura 按鈕 | 開啟 Claude Aura Studio |
| **主題** | 開啟內建圖庫，並儲存選取的主題 |
| **建立主題** | 建立或編輯由 Aura 管理的自訂主題 |
| **個人桌布 > 選擇桌布…** | 選取本機圖片，與使用中的主題分開設定 |
| **清除桌布** | 停止使用桌布，但不刪除原始圖片檔案 |
| **原始外觀** | 移除 Aura 樣式，顯示未套用所選主題的即時網站 |
| **套用主題** | 使用原始外觀後，還原已儲存的 Aura 主題 |
| **開啟桌面版** | 開啟 Claude Desktop，不對它進行任何修改 |

選取的主題會在 Aura 重新啟動後繼續使用。**原始外觀**只會關閉 Aura
的顯示層，不會刪除已儲存的主題或自訂美術素材。**預設**是 Aura
的第一個內建主題，和原始外觀不同。

浮動的 Aura 啟動按鈕會維持精簡的圓形控制項。按一下可開啟 Studio，
拖曳可移動位置，按右鍵則可開啟 Aura 選單。

個人桌布會持續連結原始圖片路徑。移動或刪除該檔案後，桌布就無法使用。
透過編輯器匯入的主題美術素材採用不同方式處理：Studio 會將素材複製或
轉換到 Aura 管理的主題資料夾。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

<a id="create-a-custom-theme"></a>
## 建立自訂主題

1. 從桌面或開始功能表開啟 **Claude Aura Studio**。
2. 開啟 **建立主題** 並選擇 **自訂預設主題**；或開啟 **主題**、選擇
   內建主題，再選擇 **複製後自訂**。
3. 調整淺色與深色配色、字體、形狀、效果和本機美術素材。
4. 在 Studio 預覽中檢查新對話與對話版面。
5. 修正任何對比或檔案大小警告。
6. 選擇 **儲存主題**。

內建檔案絕不會被覆寫。草稿若變成無效狀態，仍可繼續編輯；Aura 則會
繼續顯示上一個有效版本。

匯入的 PNG、JPEG、WebP 或 AVIF 美術素材會在本機轉換為符合容量限制的
WebP 素材。Studio 不會將來源檔案路徑儲存在主題中。完整的編輯器與主題規格
請參閱[主題套件規格](../docs/THEME_KIT_SPEC.md)。

功能可用時，Studio 可以把實際 Aura 視窗的畫面擷取當作編輯背景。
畫面擷取可能含有對話內容，只會在目前的編輯工作階段中存放於記憶體，
絕不寫入磁碟。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

<a id="built-with"></a>
## Aura 如何運作

| 組成 | 用途 |
| --- | --- |
| Windows PowerShell 與 WinForms | 安裝程式、Aura 視窗、Studio、捷徑與本機控制項 |
| Microsoft Edge WebView2 | 顯示真正的 `claude.ai` 網站 |
| Node.js 22+ | 驗證主題並建立本機主題樣式 |
| 本機 HTML、CSS、JavaScript、SVG 與 WebP | 提供 Aura 樣式與內建主題素材 |

本專案沒有 npm 套件或執行階段字型相依性。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

<a id="safety-and-privacy"></a>
## 安全性與隱私權

- Aura 會透過 Microsoft Edge WebView2 載入真正的 `claude.ai` HTTPS 網站。
- 登入服務提供者的頁面不會套用主題。
- Aura 不會開啟遠端偵錯連接埠，也不會修改 Claude Desktop。
- 主題檔案與匯入的美術素材會留在 Aura 管理的本機資料夾。
- 即時網頁仍會照常連線至 Anthropic。
- WebView 設定檔含有登入工作階段資料，請妥善保護。
- Studio 的即時頁面畫面擷取只會在編輯工作階段中留在記憶體，不會儲存到磁碟。
- 請勿選擇含敏感內容的背景圖片；即時頁面在技術上可存取其處理程序內的
  DOM 資料。
- 使用即時服務時，仍須遵守 Anthropic 現行的
  [消費者條款](https://www.anthropic.com/terms)與
  [使用政策](https://www.anthropic.com/legal/aup)。

請閱讀 [SECURITY.md](./SECURITY.md) 瞭解信任邊界；若需要登入、載入、
主題、圖片或 WebView2 相關協助，請參閱
[疑難排解](../docs/TROUBLESHOOTING.md)。

<a id="local-data"></a>
<details>
<summary><strong>本機資料夾與解除安裝保留項目</strong></summary>

Aura 會分開存放應用程式、設定、主題、草稿與瀏覽器設定檔：

| 路徑 | 內容 |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | 已安裝的 Aura 應用程式 |
| `%LOCALAPPDATA%\ClaudeAura\data` | 設定、記錄檔與 Aura 管理的本機狀態 |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | 已儲存的自訂主題與衍生美術素材 |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Studio 編輯中的草稿 |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Aura 專用的 WebView2 登入設定檔 |

請像保護任何已登入的瀏覽器設定檔一樣保護 `webview` 資料夾，不要發布或分享。
解除安裝預設會保留 `data` 與 `webview`；只有在確定要一併清除本機設定、主題和
專用登入設定檔時，才選擇明確的移除選項。

</details>

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

<a id="roadmap"></a>
## 開發藍圖

- [x] 獨立的 Windows WebView2 伴隨工具，以及可還原的 **原始外觀**
- [x] 8 個順序固定的內建主題，支援淺色與深色外觀
- [ ] 完成並檢查免寫程式碼的 Studio 視覺化編輯器
- [ ] 完成並驗收 Aura Code，使其透過官方 Remote Control 操作本機 Claude Code，
      並提供相符的終端機主題匯出
- [ ] 發布 30 分鐘自訂主題教學
- [ ] 執行最後一輪發行驗證

公開進度請參閱
[實作報告](../docs/IMPLEMENTATION_REPORT.md)與
[儲存庫 Issues](https://github.com/kaihuang1425/claude-aura/issues)。
參考預覽絕不能取代規定的 Aura 即時驗收證據。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

<a id="support"></a>
## 支援與說明文件

請先查看[疑難排解](../docs/TROUBLESHOOTING.md)。若有可重現的 Bug 或功能需求，
請使用[儲存庫的 Issues 頁面](https://github.com/kaihuang1425/claude-aura/issues)。

回報 Bug 時，請附上 Windows、Node.js 與 WebView2 版本、目前使用的主題 ID，
以及重現問題的步驟。分享記錄檔前請先檢查內容；Aura 的 UI 記錄檔位於：

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

安全性問題請依 [SECURITY.md](./SECURITY.md) 說明，透過儲存庫的非公開
安全性公告回報。

### 說明文件索引

- [疑難排解](../docs/TROUBLESHOOTING.md)
- [安全性與信任邊界](./SECURITY.md)
- [主題設定指南](../docs/THEMING.md)
- [主題套件規格](../docs/THEME_KIT_SPEC.md)
- [實作報告](../docs/IMPLEMENTATION_REPORT.md)
- [檔案清單](../docs/FILE_MANIFEST.md)
- [貢獻指南](./CONTRIBUTING.md)
- [儲存庫 Issues](https://github.com/kaihuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>貢獻檢查與專案界線</strong></summary>

提交變更前，請執行必要的檢查：

```powershell
npm run check
npm run verify:cycle
```

若只要稽核單一內建主題：

```powershell
node scripts/theme-cli.mjs qa <id>
```

請遵守以下專案界線：

- 不要新增 npm 或執行階段字型相依性。
- 8 個固定主題 ID 與順序不得變更。
- 不要將重建的 Claude 介面 HTML 當作產品內容發布。
- 不要將參考圖片當成 UI 驗收證據。
- 貢獻媒體檔案時，請附上來源、授權與散布資訊。

變更主題系統或發行版檔案樹前，請先閱讀
[CONTRIBUTING.md](./CONTRIBUTING.md)、
[主題設定指南](../docs/THEMING.md)、
[主題套件規格](../docs/THEME_KIT_SPEC.md)與
[檔案清單](../docs/FILE_MANIFEST.md)。

</details>

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

<a id="charitable-support"></a>
## 公益支持

Claude Aura 不接受支付給專案所有者的個人捐款、小費、贊助、推薦報酬或其他
經濟支持。專案所有者目前在英國受
[Student 路線簽證條件](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student)
約束；除少數例外情況外，該條件禁止自僱或從事商業活動。為避免與這些條件
發生任何潛在衝突，在條件適用期間，所有者無法接受與專案相關的捐款或小費。

覺得 Claude Aura 實用的話，[替儲存庫按個 Star](https://github.com/kaihuang1425/claude-aura)，
就是最簡單的非金錢支持方式。

<details>
<summary><strong>Student 路線背景、獨立非營利組織與捐款界線</strong></summary>

若想支持相關公益工作，可直接向以下任一獨立非營利組織捐款：

- [英國國際救援委員會（IRC UK）](https://help.rescue-uk.org/donate-web)
  協助受衝突與災害影響的人們，包括在英國重建生活的難民。國際救援委員會
  也參與 Claude Corps。
- [CodePath](https://www.every.org/codepath) 提供免費的技術教育，並以
  Anthropic 非營利合作夥伴的身分參與
  [Claude Corps](https://www.anthropic.com/news/claude-corps)。

以上連結會直接前往第三方。Claude Aura 及其所有者不會收集、處理、控制或
接收任何捐款，也不會從中獲得經濟利益。捐款處理與收據均由相關組織自行負責。
列出這些組織不代表其與 Claude Aura 存在合作、贊助、認可或官方募款關係。

</details>

<a id="license-and-notices"></a>
## 授權與聲明

專案自行撰寫的軟體依 [MIT License](./LICENSE) 散布。另請閱讀
[NOTICE.md](./NOTICE.md)與
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

MIT License 不授予 Anthropic 名稱、標誌、介面、網站或應用程式的任何權利。
展示圖說也不授予圖中介面、美術素材、名稱、標誌或人物肖像的重複使用權。
各檔案的來源與權利聲明仍然適用。

請查閱現行的
[Anthropic 商標使用準則](https://www.anthropic.com/legal/trademark-guidelines)
與[消費者條款](https://www.anthropic.com/terms)。發布、修改或轉散布受保護的
名稱、標誌、介面擷取畫面、美術素材或可辨識人物肖像前，請向相關權利人取得
一切必要許可。本儲存庫與 README 不授予這些許可。

<a id="acknowledgments"></a>
## 致謝

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 為原始
  loopback 驗證流程與親切易懂的展示方式提供了參考。
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin)
  為早期的語意主題對應方式提供了參考。
- [Best README Template](https://github.com/othneildrew/Best-README-Template)
  為本 README 以讀者為優先的架構提供了參考。
- Microsoft Edge WebView2 提供內嵌瀏覽器執行階段。

詳細授權與來源記錄於
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。列入致謝不代表有合作、
贊助或認可關係。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>
