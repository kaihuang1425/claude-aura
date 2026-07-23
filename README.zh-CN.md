<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <a href="./README.md">English</a> ·
  <strong>简体中文</strong> ·
  <a href="./README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <strong>面向 Claude 实时网站的可撤销 Windows 主题伴侣应用。</strong><br>
  本地主题 · 不修改 Claude Desktop · 一键恢复原始外观
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#主题展示">查看主题</a> ·
  <a href="#创建自定义主题">创建主题</a> ·
  <a href="./docs/TROUBLESHOOTING.md">故障排除</a> ·
  <a href="./SECURITY.md">安全</a>
</p>

> **独立项目。** Claude Aura 是非官方项目，与 Anthropic PBC 不存在关联，
> 也未获得其认可、赞助或批准。Aura 显示 `claude.ai` 的实时网站；
> 它不提供 Claude 服务，也不修改 Anthropic 已安装的应用程序。Claude、
> Anthropic 及相关名称和标识均归 Anthropic PBC 所有。项目许可证不授予
> 对这些材料的任何权利。
>
> **公开发布或商业发布前：** Anthropic 当前的
> [商标指南](https://www.anthropic.com/legal/trademark-guidelines)
> 要求使用其名称和标识必须事先获得批准，并禁止使用经过修改的标识。
> 免责声明不等同于许可。若发布版本保留 **Claude Aura** 名称或采用主题样式的
> Claude 字标，则需获得书面许可并接受适当的法律审查。

## 目录

- [关于 Claude Aura](#关于-claude-aura)
- [主题展示](#主题展示)
- [技术构成](#技术构成)
- [快速开始](#快速开始)
- [使用 Aura](#使用-aura)
- [内置主题](#内置主题)
- [创建自定义主题](#创建自定义主题)
- [本地数据](#本地数据)
- [安全与隐私](#安全与隐私)
- [路线图](#路线图)
- [参与贡献](#参与贡献)
- [许可证与声明](#许可证与声明)
- [支持](#支持)
- [致谢](#致谢)

## 关于 Claude Aura

Claude Aura 在专用的 Microsoft Edge WebView2 窗口中打开真实的
`claude.ai` 网站，并应用本地视觉主题。它适合希望拥有更个性化工作区，
但不想修改 Claude Desktop 或用截图替代实时界面的用户。

| Aura 的功能 | Aura 不会执行的操作 |
| --- | --- |
| 在 WebView2 中加载实时 `claude.ai` 界面 | 用重建的界面替代 Claude |
| 应用可撤销的本地样式 | 修改 Claude Desktop、`app.asar`、Windows 软件包或代码签名 |
| 提供八个内置主题 | 更改 Claude 账号、聊天、API 密钥、模型或服务提供商设置 |
| 提供 Studio，用于创建本地自定义主题 | 声称自己是 Anthropic 产品或官方主题系统 |
| 在应用内提供**原始外观** | 关闭样式时删除已保存的主题 |

Aura 0.3 目前只为实时网站应用主题，尚不会为 Claude Desktop 的 Code
界面或 Claude Code 终端应用主题；Aura 中的普通聊天也不能直接访问本地项目。
最终发布前，必须完成 Aura Code 并通过验收：使用官方
[Remote Control](https://code.claude.com/docs/en/remote-control)，验证 Aura
能够在实时 `claude.ai/code` 中操作本地 Claude Code 会话，并提供匹配的终端
主题导出，作为受限环境下的替代方案。整个过程不会修改 Claude Desktop。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 主题展示

> **参考资料状态：** 这些由用户提供的图片用于传达预期的视觉方向。
> 其中可能包含用于说明的界面内容，并非实时验收证据，也不能证明
> `claude.ai` 的当前行为。这些图片不是主题背景，不得导入 Aura，
> 并且不会包含在发布安装程序中。
>
> 预览图包含第三方产品界面、名称或标识，以及类人肖像美术作品。
> 收录这些内容并不授予重复使用权。在进一步发布或再分发前，请确认
> 适用的界面、商标、美术作品及肖像权利。

### 日式电影编辑风

暖色纸张、炭黑墨色、低饱和靛蓝与克制的朱红。

<p align="center">
  <img src="./docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="日式电影编辑风深色新聊天参考预览"
       width="900"><br>
  <sub>深色 · 新聊天 · 用户提供的文档展示图</sub>
</p>

<details>
<summary>查看对话视图</summary>

<p align="center">
  <img src="./docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="日式电影编辑风深色对话参考预览"
       width="900"><br>
  <sub>深色 · 对话 · 用户提供的文档展示图</sub>
</p>

</details>

### 日式偶像

暖奶油色、柔粉、玫瑰色、珠光淡紫色与细腻的丝带元素。

<p align="center">
  <img src="./docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="日式偶像浅色新聊天参考预览"
       width="900"><br>
  <sub>浅色 · 新聊天 · 用户提供的文档展示图</sub>
</p>

<details>
<summary>查看对话视图</summary>

<p align="center">
  <img src="./docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="日式偶像浅色对话参考预览"
       width="900"><br>
  <sub>浅色 · 对话 · 用户提供的文档展示图</sub>
</p>

</details>

### 韩式偶像

冷白、长春花蓝、全息银色与层次分明的音乐感玻璃材质。

<p align="center">
  <img src="./docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="韩式偶像浅色新聊天参考预览"
       width="900"><br>
  <sub>浅色 · 新聊天 · 用户提供的文档展示图</sub>
</p>

<details>
<summary>查看对话视图</summary>

<p align="center">
  <img src="./docs/readme-showcase/korean-idol-light-conversation.png"
       alt="韩式偶像浅色对话参考预览"
       width="900"><br>
  <sub>浅色 · 对话 · 用户提供的文档展示图</sub>
</p>

</details>

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 技术构成

| 构成 | 用途 |
| --- | --- |
| Windows PowerShell 和 WinForms | 安装程序、Aura 窗口、Studio、快捷方式及本地控件 |
| Microsoft Edge WebView2 | 显示真实的 `claude.ai` 网站 |
| Node.js 22+ | 校验主题并构建本地主题样式 |
| 本地 HTML、CSS、JavaScript、SVG 和 WebP | 提供 Aura 样式和内置主题素材 |

项目不依赖任何 npm 软件包或运行时字体。

## 快速开始

### 系统要求

- Windows 10 或 Windows 11
- 网络连接和 Claude 账号
- [Node.js 22 或更高版本](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

大多数当前使用的 Windows 电脑已安装 WebView2。如果 Aura 无法打开浏览器窗口，
请安装或修复 Evergreen WebView2 Runtime 后重试。Claude Desktop 为可选应用，
并始终独立运行。

### 安装

1. 下载
   [最新发布版 ZIP](https://github.com/erichuang1425/claude-aura/releases)。
2. 在文件资源管理器中右键单击 ZIP，然后选择**全部解压缩**。
3. 打开解压后的文件夹，双击 **Install Claude Aura.cmd**。
4. 等待安装程序关闭并打开 **Claude Aura** 窗口。
5. 如果 `claude.ai` 提示登录，请在 Aura 中完成登录。
6. 点击悬浮 Aura 按钮打开 Studio，然后选择**主题**。

非管理员权限安装程序会先运行内置校验，然后将应用程序文件复制到：

```text
%LOCALAPPDATA%\ClaudeAura\app
```

安装程序会在桌面和“开始”菜单中创建 **Claude Aura** 和
**Claude Aura Studio** 快捷方式。主题设置和登录数据与应用程序分开存储，
因此重新安装 Aura 不会在不提示的情况下替换这些数据。

安装过程不会修改或替换 Claude Desktop。

开发者可以克隆仓库并从工作区运行同一个安装程序，无需下载 ZIP。
从工作区安装时，安装前会运行完整的仓库测试套件。

### 卸载

先右键单击悬浮 Aura 按钮，选择**退出 Claude Aura**。然后打开
**开始 > Claude Aura > Uninstall Claude Aura**，或在解压后的发布文件中
双击 **Uninstall Claude Aura.cmd**。如果 Aura 仍在运行，卸载程序将拒绝继续。

默认情况下，卸载操作会移除 Aura 应用程序和快捷方式，但会保留本地主题设置
及 Aura 独立的 WebView 登录配置文件，供以后重新安装时使用。卸载程序会先询问，
再决定是否同时删除这些文件夹。选择删除会移除 Aura 的本地登录会话，但绝不会
删除 Claude Desktop、用户的 Anthropic 账号或服务器端账号数据。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 使用 Aura

| 操作 | 作用 |
| --- | --- |
| 点击悬浮 Aura 按钮 | 打开 Claude Aura Studio |
| **主题** | 打开内置主题库并保存选中的主题 |
| **创建主题** | 创建或编辑由 Aura 管理的自定义主题 |
| **个人壁纸 > 选择壁纸…** | 选择一张与当前主题分开管理的本地图片 |
| **清除壁纸** | 停止使用壁纸，但不删除其源文件 |
| **原始外观** | 移除 Aura 样式，显示未应用所选主题的实时网站 |
| **应用主题** | 使用原始外观后，恢复已保存的 Aura 主题 |
| **打开桌面版** | 打开 Claude Desktop，但不对其进行修改 |

所选主题会在 Aura 重新启动后继续使用。**原始外观**会关闭 Aura 的呈现层，
但不会删除已保存的主题或自定义美术素材。**默认**是 Aura 的第一个内置主题，
与“原始外观”并不相同。

悬浮 Aura 启动按钮始终保持为紧凑的圆形控件。点击可打开 Studio，
拖动可移动位置，右键单击可打开 Aura 菜单。

个人壁纸始终链接到原始图片路径。移动或删除该文件后，壁纸将无法使用。
通过编辑器导入的主题美术素材采用另一套处理方式：Studio 会将素材复制或转换到
由 Aura 管理的主题文件夹中。

## 内置主题

Aura 按固定顺序提供八个内置主题：

| # | 主题 | 稳定 ID |
| ---: | --- | --- |
| 1 | 默认 | `default` |
| 2 | 日式电影编辑风 | `japanese-film-editorial` |
| 3 | 韩式精品 | `korean-prestige` |
| 4 | 卡通工作室 | `cartoon-studio` |
| 5 | 动漫暮色 | `anime-twilight` |
| 6 | 自习图书馆 | `study-library` |
| 7 | 日式偶像 | `japanese-idol` |
| 8 | 韩式偶像 | `korean-idol` |

内置主题为只读。如需自定义某个内置主题，Studio 会创建可编辑的副本。

## 创建自定义主题

1. 从桌面或“开始”菜单打开 **Claude Aura Studio**。
2. 打开**创建主题**并选择**自定义默认主题**；也可以打开**主题**，
   选择一个内置主题，再选择**复制并自定义**。
3. 调整浅色和深色模式下的颜色、字体、形状、效果及本地美术素材。
4. 在 Studio 预览中检查“新聊天”和“对话”布局。
5. 解决所有对比度或文件大小警告。
6. 选择**保存主题**。

内置文件绝不会被覆盖。如果草稿变为无效状态，它仍可继续编辑，
同时 Aura 会继续显示上一个有效版本。

导入的 PNG、JPEG、WebP 或 AVIF 美术素材会在本地转换为符合容量限制的
WebP 资源。Studio 不会在主题中存储源文件路径。有关完整的编辑器和主题规范，
请参阅[主题工具包规范](./docs/THEME_KIT_SPEC.md)。

在可用的情况下，Studio 可以使用实际 Aura 窗口的捕获画面作为编辑背景。
该画面可能包含对话内容，仅在当前编辑会话期间保留在内存中，绝不会写入磁盘。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 本地数据

Aura 会分别存储应用程序、设置、主题、草稿和浏览器配置文件：

| 路径 | 内容 |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | 已安装的 Aura 应用程序 |
| `%LOCALAPPDATA%\ClaudeAura\data` | 设置、日志及由 Aura 管理的本地状态 |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | 已保存的自定义主题和派生美术素材 |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | 正在编辑的 Studio 草稿 |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Aura 独立的 WebView2 登录配置文件 |

请像保护任何已登录的浏览器配置文件一样保护 `webview` 文件夹，不要发布或共享。
默认卸载操作会保留 `data` 和 `webview`；仅当确定要同时清除这些本地设置、
主题和独立登录配置文件时，才选择明确的删除选项。

## 安全与隐私

- Aura 使用 Microsoft Edge WebView2 加载 `claude.ai` 的真实 HTTPS 网站。
- 登录服务提供商页面不会应用主题。
- Aura 不会打开远程调试端口，也不会修改 Claude Desktop。
- 主题文件和导入的美术素材保存在由 Aura 管理的本地文件夹中。
- 实时网页仍会像平常一样连接 Anthropic。
- WebView 配置文件包含登录会话数据，必须妥善保护。
- Studio 的实时页面捕获画面仅在编辑会话期间保留在内存中，不会保存到磁盘。
- 请勿选择包含敏感内容的背景图片；实时网页在技术上可以访问其自身进程内的
  DOM 数据。
- 使用实时服务仍须遵守 Anthropic 当前的
  [消费者条款](https://www.anthropic.com/terms)和
  [使用政策](https://www.anthropic.com/legal/aup)。

请阅读 [SECURITY.md](./SECURITY.md) 了解信任边界，并参阅
[故障排除](./docs/TROUBLESHOOTING.md)获取登录、加载、主题、图片及
WebView2 相关帮助。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 路线图

- [x] 专用的 Windows WebView2 伴侣应用及可撤销的**原始外观**
- [x] 八个支持浅色和深色模式的稳定内置主题
- [ ] 完成并评审无代码 Studio 可视化编辑器
- [ ] 完成并验收 Aura Code：通过官方 Remote Control 为本地 Claude Code
      会话应用主题，并支持导出配套终端主题
- [ ] 发布 30 分钟自定义主题教程
- [ ] 执行最终发布校验

公开进度请参阅
[实施报告](./docs/IMPLEMENTATION_REPORT.md)和
[仓库 Issues](https://github.com/erichuang1425/claude-aura/issues)。
参考预览绝不能替代规定的 Aura 实时验收证据。

## 参与贡献

提交更改前，请运行以下必要检查：

```powershell
npm run check
npm run verify:cycle
```

如需审核单个内置主题，请运行：

```powershell
node scripts/theme-cli.mjs qa <id>
```

请遵守以下项目边界：

- 不得添加 npm 依赖项或运行时字体依赖项。
- 保持八个稳定主题 ID 及其顺序不变。
- 不得将重建的 Claude 界面 HTML 作为产品内容发布。
- 不得将参考图片作为界面验收证据提交。
- 对于贡献的媒体文件，请提供来源、许可证和分发信息。

更改主题系统或发布目录树前，请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)、
[主题指南](./docs/THEMING.md)、
[主题工具包规范](./docs/THEME_KIT_SPEC.md)及
[文件清单](./docs/FILE_MANIFEST.md)。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>

## 许可证与声明

项目原创软件依据 [MIT License](./LICENSE) 分发。另请阅读
[NOTICE.md](./NOTICE.md)和
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

MIT License 不授予对 Anthropic 的名称、标识、界面、网站或应用程序的任何权利。
展示图说明文字也不授予对所显示界面、美术作品、名称、标识或人物肖像的重复使用权。
各文件对应的来源及权利声明仍然适用。

请查阅当前的
[Anthropic 商标指南](https://www.anthropic.com/legal/trademark-guidelines)
和[消费者条款](https://www.anthropic.com/terms)。在发布、修改或再分发受保护的
名称、标识、界面捕获画面、美术作品或可识别人物肖像前，请向相关权利人取得
所有必要许可。本仓库和 README 不授予此类许可。

## 支持

请先查看[故障排除](./docs/TROUBLESHOOTING.md)。如需提交可复现的故障或功能建议，
请使用[仓库 Issues 页面](https://github.com/erichuang1425/claude-aura/issues)。

报告故障时，请提供 Windows、Node.js 和 WebView2 版本、当前主题 ID，
以及复现问题的步骤。共享日志前请先检查内容；Aura 的界面日志存储在：

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

请按照 [SECURITY.md](./SECURITY.md) 中的说明，通过仓库的私有安全公告报告安全问题。

## 致谢

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin)
  为最初的回环校验流程和易于浏览的主题展示方式提供了参考。
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin)
  为早期语义主题映射提供了参考。
- [Best README Template](https://github.com/othneildrew/Best-README-Template)
  为本 README 以读者为先的结构提供了参考。
- Microsoft Edge WebView2 提供嵌入式浏览器运行时。

详细的许可证和来源信息记录在
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)中。致谢不代表存在关联、
赞助或认可关系。

<p align="right">(<a href="#readme-top">返回顶部</a>)</p>
