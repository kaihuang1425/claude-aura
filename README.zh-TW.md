<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <strong>繁體中文</strong>
</p>

<p align="center">
  <strong>搭配即時 Claude 網站使用、可隨時還原的 Windows 主題工具。</strong><br>
  本機主題 · 不修改 Claude Desktop · 一鍵回到原始外觀
</p>

<p align="center">
  <a href="#開始使用">開始使用</a> ·
  <a href="#主題展示">瀏覽主題</a> ·
  <a href="#建立自訂主題">建立主題</a> ·
  <a href="./docs/TROUBLESHOOTING.md">疑難排解</a> ·
  <a href="./SECURITY.md">安全性</a>
</p>

> **獨立專案。** Claude Aura 是非官方專案，與 Anthropic PBC 沒有合作、
> 認可、贊助或核准關係。Aura 顯示 `claude.ai` 即時網站；本專案不提供
> Claude 服務，也不會修改 Anthropic 安裝在電腦上的應用程式。Claude、
> Anthropic 和相關名稱及標誌均屬 Anthropic PBC 所有。本專案授權不包含
> 這些素材的任何權利。
>
> **公開或商業發布前請留意：** Anthropic 現行的
> [商標使用準則](https://www.anthropic.com/legal/trademark-guidelines)
> 規定，使用其名稱與標誌前必須取得核准，且不得改造標誌。免責聲明不等於
> 取得許可。若發布版本保留 **Claude Aura** 名稱或經主題化的 Claude
> 文字標誌，必須先取得書面許可，並接受適當的法律審查。

## 目錄

- [關於 Claude Aura](#關於-claude-aura)
- [主題展示](#主題展示)
- [使用技術](#使用技術)
- [開始使用](#開始使用)
- [使用 Aura](#使用-aura)
- [內建主題](#內建主題)
- [建立自訂主題](#建立自訂主題)
- [本機資料](#本機資料)
- [安全性與隱私權](#安全性與隱私權)
- [開發藍圖](#開發藍圖)
- [參與貢獻](#參與貢獻)
- [授權與聲明](#授權與聲明)
- [支援](#支援)
- [致謝](#致謝)

## 關於 Claude Aura

Claude Aura 會在獨立的 Microsoft Edge WebView2 視窗中開啟真正的
`claude.ai` 網站，並套用本機視覺主題。它適合想打造個人化工作空間，
但不想修改 Claude Desktop，也不想以螢幕截圖取代即時介面的人。

| Aura 會做的事 | Aura 不會做的事 |
| --- | --- |
| 在 WebView2 中載入即時 `claude.ai` 介面 | 以重建的介面取代 Claude |
| 套用可還原的本機樣式 | 修改 Claude Desktop、`app.asar`、Windows 套件或程式碼簽章 |
| 提供 8 個內建主題 | 變更 Claude 帳號、對話、API 金鑰、模型或服務提供者設定 |
| 提供 Studio 來建立本機自訂主題 | 宣稱是 Anthropic 產品或官方主題系統 |
| 在 App 內提供 **原始外觀** | 關閉主題樣式時刪除已儲存的主題 |

Aura 0.3 目前只會替即時網站套用主題，還不會替 Claude Desktop 的 Code
介面或 Claude Code 終端機套用主題；Aura 裡的一般對話也無法直接存取本機
專案。正式發行前，必須完成 Aura Code 並通過驗收：透過官方
[Remote Control](https://code.claude.com/docs/en/remote-control)，證明 Aura
能在即時 `claude.ai/code` 中操作本機 Claude Code 工作階段，並提供相符的
終端機主題匯出，讓無法使用 Remote Control 的環境仍有可用選項。整個流程
不會修改 Claude Desktop。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

## 主題展示

> **參考圖說明：** 這些由使用者提供的圖片用來呈現預期的視覺方向。
> 圖片可能含有示意用的介面內容，不是即時驗收證據，也不能證明目前
> `claude.ai` 的實際行為。這些圖片不是主題背景、不得匯入 Aura，且不會
> 包含在發行版安裝程式中。
>
> 預覽圖含有第三方產品介面、名稱或標誌，以及人物肖像風格的美術素材。
> 收錄這些圖片不代表取得重複使用的權利。進一步發布或轉散布前，請先確認
> 適用的介面、商標、美術素材與肖像權利。

### 日系電影編輯風

暖色紙張、炭黑墨色、低彩度靛藍與節制的朱紅色。

<p align="center">
  <img src="./docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="日系電影編輯風深色新對話參考預覽"
       width="900"><br>
  <sub>深色 · 新對話 · 使用者提供的說明文件展示圖</sub>
</p>

<details>
<summary>查看對話畫面</summary>

<p align="center">
  <img src="./docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="日系電影編輯風深色對話參考預覽"
       width="900"><br>
  <sub>深色 · 對話 · 使用者提供的說明文件展示圖</sub>
</p>

</details>

### 日系偶像

暖奶油色、柔粉色、玫瑰色、珠光淡紫色與細緻的緞帶細節。

<p align="center">
  <img src="./docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="日系偶像淺色新對話參考預覽"
       width="900"><br>
  <sub>淺色 · 新對話 · 使用者提供的說明文件展示圖</sub>
</p>

<details>
<summary>查看對話畫面</summary>

<p align="center">
  <img src="./docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="日系偶像淺色對話參考預覽"
       width="900"><br>
  <sub>淺色 · 對話 · 使用者提供的說明文件展示圖</sub>
</p>

</details>

### 韓系偶像

冷白色、長春花藍、全像銀色與層次分明的音樂玻璃質感。

<p align="center">
  <img src="./docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="韓系偶像淺色新對話參考預覽"
       width="900"><br>
  <sub>淺色 · 新對話 · 使用者提供的說明文件展示圖</sub>
</p>

<details>
<summary>查看對話畫面</summary>

<p align="center">
  <img src="./docs/readme-showcase/korean-idol-light-conversation.png"
       alt="韓系偶像淺色對話參考預覽"
       width="900"><br>
  <sub>淺色 · 對話 · 使用者提供的說明文件展示圖</sub>
</p>

</details>

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

## 使用技術

| 組成 | 用途 |
| --- | --- |
| Windows PowerShell 與 WinForms | 安裝程式、Aura 視窗、Studio、捷徑與本機控制項 |
| Microsoft Edge WebView2 | 顯示真正的 `claude.ai` 網站 |
| Node.js 22+ | 驗證主題並建立本機主題樣式 |
| 本機 HTML、CSS、JavaScript、SVG 與 WebP | 提供 Aura 樣式與內建主題素材 |

本專案沒有 npm 套件或執行階段字型相依性。

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
   [最新發行版 ZIP](https://github.com/erichuang1425/claude-aura/releases)。
2. 在檔案總管中按 ZIP 檔案右鍵，選擇 **全部解壓縮**。
3. 開啟解壓縮後的資料夾，按兩下 **Install Claude Aura.cmd**。
4. 等待安裝程式關閉並開啟 **Claude Aura** 視窗。
5. 如果 `claude.ai` 要求登入，請直接在 Aura 內完成登入。
6. 按一下浮動的 Aura 按鈕開啟 Studio，再選擇 **主題**。

這個安裝程式不需要系統管理員權限。它會先執行內建驗證，再將應用程式
檔案複製到：

```text
%LOCALAPPDATA%\ClaudeAura\app
```

安裝程式會在桌面與開始功能表建立 **Claude Aura** 和
**Claude Aura Studio** 捷徑。主題設定與登入資料會和應用程式分開儲存，
因此重新安裝 Aura 時不會在未告知的情況下取代它們。

安裝過程不會修改或取代 Claude Desktop。

開發者也可以複製儲存庫，不下載 ZIP，直接從工作目錄執行同一個安裝程式。
從工作目錄安裝時，會先執行完整的儲存庫測試套件。

### 解除安裝

請先在浮動的 Aura 按鈕上按右鍵，選擇 **結束 Claude Aura**。接著開啟
**開始 > Claude Aura > 解除安裝 Claude Aura**，或在解壓縮後的發行版中
按兩下 **Uninstall Claude Aura.cmd**。Aura 仍在執行時，解除安裝程式
不會繼續。

解除安裝預設只會移除 Aura 應用程式與捷徑，並保留本機主題設定和 Aura
專用的 WebView 登入設定檔，方便日後重新安裝。解除安裝程式也會先詢問，
再決定是否一併移除這些資料夾。選擇清除後，會移除 Aura 的本機登入工作階段；
不會移除 Claude Desktop、Anthropic 帳號或伺服器端的帳號資料。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

## 使用 Aura

| 操作 | 功能 |
| --- | --- |
| 按一下浮動的 Aura 按鈕 | 開啟 Claude Aura Studio |
| **主題** | 開啟內建圖庫，並儲存選取的主題 |
| **建立主題** | 建立或編輯由 Aura 管理的自訂主題 |
| **個人桌布 > 選擇桌布…** | 選取本機圖片，與使用中的主題分開設定 |
| **清除桌布** | 停止使用桌布，但不刪除原始圖片檔案 |
| **原始外觀** | 移除 Aura 樣式，不套用選取的主題並顯示即時網站 |
| **套用主題** | 使用原始外觀後，還原已儲存的 Aura 主題 |
| **開啟桌面版** | 開啟 Claude Desktop，不對它進行任何修改 |

選取的主題會在 Aura 重新啟動後繼續使用。**原始外觀** 只會關閉 Aura
的顯示層，不會刪除已儲存的主題或自訂美術素材。**預設**是 Aura
的第一個內建主題，和原始外觀不同。

浮動的 Aura 啟動按鈕會維持精簡的圓形控制項。按一下可開啟 Studio，
拖曳可移動位置，按右鍵則可開啟 Aura 選單。

個人桌布會持續連結原始圖片路徑。移動或刪除該檔案後，桌布就無法使用。
透過編輯器匯入的主題美術素材採用不同方式處理：Studio 會將素材複製或
轉換到 Aura 管理的主題資料夾。

## 內建主題

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
WebP 素材。Studio 不會將來源檔案路徑儲存在主題中。完整的編輯器與主題
規格請參閱
[主題套件規格](./docs/THEME_KIT_SPEC.md)。

功能可用時，Studio 可以把實際 Aura 視窗的畫面擷取當作編輯背景。
畫面擷取可能含有對話內容，只會在目前的編輯工作階段中存放於記憶體，
絕不寫入磁碟。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

## 本機資料

Aura 會分開存放應用程式、設定、主題、草稿與瀏覽器設定檔：

| 路徑 | 內容 |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | 已安裝的 Aura 應用程式 |
| `%LOCALAPPDATA%\ClaudeAura\data` | 設定、記錄檔與 Aura 管理的本機狀態 |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | 已儲存的自訂主題與衍生美術素材 |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Studio 編輯中的草稿 |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Aura 專用的 WebView2 登入設定檔 |

請像保護任何已登入的瀏覽器設定檔一樣保護 `webview` 資料夾，不要發布或
分享。解除安裝預設會保留 `data` 與 `webview`；只有在確定要一併清除
本機設定、主題和專用登入設定檔時，才選擇明確的移除選項。

## 安全性與隱私權

- Aura 會透過 Microsoft Edge WebView2 載入真正的 `claude.ai` HTTPS 網站。
- 登入服務提供者的頁面不會套用主題。
- Aura 不會開啟遠端偵錯連接埠，也不會修改 Claude Desktop。
- 主題檔案與匯入的美術素材會留在 Aura 管理的本機資料夾。
- 即時網頁仍會照常連線至 Anthropic。
- WebView 設定檔含有登入工作階段資料，請妥善保護。
- Studio 的即時頁面畫面擷取只會在編輯工作階段中留在記憶體，不會儲存
  到磁碟。
- 請勿選擇敏感圖片作為背景；即時頁面在技術上可存取其處理程序內的
  DOM 資料。
- 使用即時服務時，仍須遵守 Anthropic 現行的
  [消費者條款](https://www.anthropic.com/terms)與
  [使用政策](https://www.anthropic.com/legal/aup)。

請閱讀 [SECURITY.md](./SECURITY.md) 瞭解信任邊界；若需要登入、載入、
主題、圖片或 WebView2 相關協助，請參閱
[疑難排解](./docs/TROUBLESHOOTING.md)。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

## 開發藍圖

- [x] 獨立的 Windows WebView2 伴隨工具，以及可還原的 **原始外觀**
- [x] 8 個順序固定的內建主題，支援淺色與深色外觀
- [ ] 完成並檢查免寫程式碼的 Studio 視覺化編輯器
- [ ] 完成並驗收 Aura Code：透過官方 Remote Control 替本機 Claude Code
      工作階段套用主題，並可匯出相符的終端機主題
- [ ] 發布 30 分鐘自訂主題教學
- [ ] 執行最後一輪發行驗證

公開進度請參閱
[實作報告](./docs/IMPLEMENTATION_REPORT.md)與
[儲存庫議題](https://github.com/erichuang1425/claude-aura/issues)。
參考預覽絕不能取代規定的 Aura 即時驗收證據。

## 參與貢獻

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
[主題設定指南](./docs/THEMING.md)、
[主題套件規格](./docs/THEME_KIT_SPEC.md)與
[檔案清單](./docs/FILE_MANIFEST.md)。

<p align="right">(<a href="#readme-top">回到頂端</a>)</p>

## 授權與聲明

專案自行撰寫的軟體依 [MIT License](./LICENSE) 散布。另請閱讀
[NOTICE.md](./NOTICE.md)與
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

MIT License 不授予 Anthropic 名稱、標誌、介面、網站或應用程式的任何
權利。展示圖說也不授予圖中介面、美術素材、名稱、標誌或人物肖像的
重複使用權。各檔案的來源與權利聲明仍然適用。

請查閱最新的
[Anthropic 商標使用準則](https://www.anthropic.com/legal/trademark-guidelines)
與[消費者條款](https://www.anthropic.com/terms)。發布、修改或轉散布受
保護的名稱、標誌、介面擷取畫面、美術素材或可辨識人物肖像前，請向相關
權利人取得一切必要許可。本儲存庫與 README 不授予這些許可。

## 支援

請先查看[疑難排解](./docs/TROUBLESHOOTING.md)。若有可重現的 Bug 或功能
需求，請使用
[儲存庫的 Issues 頁面](https://github.com/erichuang1425/claude-aura/issues)。

回報 Bug 時，請附上 Windows、Node.js 與 WebView2 版本、目前使用的主題
ID，以及重現問題的步驟。分享記錄檔前請先檢查內容；Aura 的 UI 記錄檔
位於：

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

安全性問題請依 [SECURITY.md](./SECURITY.md) 說明，透過儲存庫的非公開
安全性公告回報。

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
