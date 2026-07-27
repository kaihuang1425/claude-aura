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
  <strong>Tiếng Việt</strong> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Cá nhân hóa giao diện live của Claude theo kiểu chủ đề trên Windows một cách có thể hoàn nguyên.</strong><br>
  Chủ đề cục bộ · Không vá Claude Desktop · Quay lại giao diện gốc bằng một cú nhấp chuột
</p>

<p align="center">
  <a href="#getting-started">Bắt đầu</a> ·
  <a href="#theme-showcase">Xem bộ sưu tập theme</a> ·
  <a href="#create-a-custom-theme">Tạo theme</a> ·
  <a href="../docs/TROUBLESHOOTING.md">Xử lý sự cố</a> ·
  <a href="./SECURITY.md">Bảo mật</a>
</p>

<p align="center">
  <a href="https://github.com/kaihuang1425/claude-aura"><strong>Nếu Claude Aura hữu ích với bạn, hãy gắn sao cho dự án trên GitHub.</strong></a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Tối · Chat mới · bản trình diễn tài liệu do người dùng cung cấp</sub>
</p>

<p align="center"><sub>Xem trước tham chiếu · không phải nền theme có thể nhập hoặc bằng chứng chấp nhận trực tiếp</sub></p>

> **Independent project.** Claude Aura là dự án độc lập, không thuộc Anthropic, không được liên kết, tài trợ, hay chấp thuận bởi Anthropic PBC. Aura hiển thị website `claude.ai` trực tiếp; nó không cung cấp Claude hay sửa đổi ứng dụng cài đặt của Anthropic. Claude, Anthropic và các tên/nhãn hiệu liên quan thuộc sở hữu của Anthropic PBC. Giấy phép dự án không cấp quyền nào cho các tài sản này.

<details>
<summary><strong>Ghi chú nhãn hiệu khi phát hành công khai hoặc thương mại</strong></summary>

> **Trước khi phát hành công khai hoặc thương mại:** Hướng dẫn nhãn hiệu hiện tại của
> Anthropic [Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
> yêu cầu phê duyệt trước đối với tên và nhãn hiệu, và cấm thay đổi nhãn hiệu. Một
> lời từ chối trách nhiệm không có giá trị cho phép. Một bản phát hành giữ tên
> **Claude Aura** hoặc wordmark Claude theo chủ đề cần có quyền bằng văn bản và
> đánh giá pháp lý phù hợp.

</details>

<a id="contents"></a>
<details>
<summary><strong>Mục lục</strong></summary>

- [Claude Aura](#claude-aura)
  - [Vì sao Aura](#why-aura)
  - [Bắt đầu nhanh](#quick-start)
    - [Yêu cầu](#requirements)
    - [Cài đặt](#installation)
    - [Gỡ cài đặt](#uninstall)
  - [Bộ sưu tập theme](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Sử dụng Aura](#use-aura)
  - [Tạo theme tùy chỉnh](#create-a-custom-theme)
  - [Aura hoạt động như thế nào](#how-aura-works)
  - [An toàn và quyền riêng tư](#safety-and-privacy)
  - [Lộ trình](#roadmap)
  - [Hỗ trợ và tài liệu](#support-and-documentation)
    - [Bản đồ tài liệu](#documentation-map)
  - [Ủng hộ từ thiện](#charitable-support)
  - [Giấy phép và thông báo](#license-and-notices)
  - [Lời cảm ơn](#acknowledgments)

</details>

<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Vì sao Aura

- **Dùng website trực tiếp của Claude.** Aura giữ nguyên giao diện thực tế và các điều khiển gốc thay vì thay thế bằng một màn hình tái tạo.
- **Giữ thay đổi cục bộ và có thể hoàn nguyên.** Nó áp dụng styling cục bộ mà không vá Claude Desktop, và **Original look** gỡ lớp trình bày của Aura chỉ với một cú nhấp.
- **Khởi đầu bằng tám theme tích hợp sẵn.** Mỗi theme là điểm khởi đầu ổn định, chỉ đọc cho một không gian làm việc cá nhân hóa.
- **Tạo theme mà không ghi đè các bản gốc.** Claude Aura Studio hỗ trợ chỉnh sửa màu sắc, phông chữ, hình khối, hiệu ứng và artwork cục bộ.

Aura 0.3 hiện tại chỉ theme website trực tiếp. Nó chưa theme Claude Desktop Code hoặc terminal Claude Code, và chat thông thường bên trong Aura chưa có quyền truy cập dự án cục bộ. Trước khi phát hành cuối, Aura Code cần vượt qua kiểm tra chặn phát hành bằng phiên [Remote Control](https://code.claude.com/docs/en/remote-control) có theme chính thức trên `claude.ai/code`; export terminal-theme tương ứng phục vụ môi trường hạn chế mà không vá Claude Desktop.

<details>
<summary><strong>Khả năng đầy đủ và phạm vi loại trừ</strong></summary>

Claude Aura mở website thực `claude.ai` trong cửa sổ Microsoft Edge WebView2 riêng biệt và áp dụng chủ đề trực quan cục bộ. Nó được thiết kế cho những ai muốn không gian làm việc cá nhân hơn mà không vá Claude Desktop hoặc thay thế giao diện live bằng một screenshot.

| Aura làm | Aura không làm |
| --- | --- |
| Tải giao diện live `claude.ai` trong WebView2 | Thay thế Claude bằng giao diện tái tạo |
| Áp dụng styling cục bộ có thể hoàn nguyên | Vá Claude Desktop, `app.asar`, gói Windows hay chữ ký code |
| Bao gồm tám theme tích hợp sẵn | Thay đổi tài khoản, cuộc trò chuyện, khóa API, model hoặc cài đặt nhà cung cấp Claude |
| Cung cấp Studio cho theme tùy chỉnh cục bộ | Tự nhận là sản phẩm Anthropic hoặc hệ thống theme chính thức |
| Cung cấp **Original look** trong app | Xóa theme đã lưu khi tắt chức năng styling |

</details>

<p align="right">(<a href="#readme-top">quay về đầu trang</a>)</p>
<a id="getting-started"></a>
## Bắt đầu nhanh

### Yêu cầu

- Windows 10 hoặc Windows 11
- Kết nối Internet và tài khoản Claude
- [Node.js 22 trở lên](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 có sẵn trên hầu hết máy Windows hiện đại. Nếu Aura không mở được cửa sổ trình duyệt, hãy cài lại hoặc sửa chữa Evergreen WebView2 Runtime rồi thử lại.
Claude Desktop là tuỳ chọn và vẫn là một ứng dụng riêng biệt.

### Cài đặt

Mở [phiên bản mới nhất](https://github.com/kaihuang1425/claude-aura/releases) và chọn một trong hai đường dẫn này. Cả hai sẽ cài cùng một phiên bản cho tài khoản Windows hiện tại.

| Path | Use it when | Download |
| --- | --- | --- |
| **Unsigned Setup** | Bạn muốn trình cài đặt hướng dẫn đơn giản hơn và Windows mở nó bình thường | `Claude-Aura-Setup-v<version>-UNSIGNED.exe` cùng với `.sha256` và `.manifest.json` của nó |
| **ZIP + CMD fallback** | Windows cảnh báo hoặc chặn Setup không ký, hoặc bạn ưu tiên các script nguồn dễ đọc | `claude-aura-v<version>.zip` cùng với `.sha256` của nó |

#### Path 1 ??Unsigned Setup

1. Trong **Assets**, tải `-UNSIGNED.exe`, `.sha256` và `.manifest.json` của nó. Không dùng các kho lưu trữ **Source code** tự động của GitHub.
2. So sánh SHA-256 của file Setup với cả hai file đi kèm. Dừng lại và xóa các tệp tải xuống nếu bất kỳ giá trị nào khác nhau.
3. Windows không thể xác minh publisher của trình cài đặt này vì nhà phát triển không có chứng chỉ ký mã. Nếu Windows cảnh báo hoặc chặn, đừng bỏ qua cảnh báo; hãy dùng Path 2.
4. Nếu mở bình thường, hãy làm theo Setup. Nó kiểm tra Node.js và WebView2, cài vào dưới `%LOCALAPPDATA%\ClaudeAura`, thêm mục đăng ký **Installed apps** và các shortcut, sau đó mở Aura.

#### Path 2 ??ZIP + CMD fallback

1. Trong **Assets**, tải `claude-aura-v<version>.zip` và `.sha256` tương ứng. Không dùng các archive **Source code** tự động của GitHub.
2. So sánh SHA-256 của ZIP với tệp đi kèm. Nếu khác, dừng lại và xóa cả hai tệp.
3. Chọn **Extract all**. Trong thư mục `claude-aura` đã giải nén, nhấp đúp **Install Claude Aura.cmd**. Không chạy từ bản xem trước ZIP.
4. Trình cài đặt CMD/PowerShell có thể đọc được sẽ kiểm tra Node.js và WebView2, cài Aura, tạo shortcut và mở nó. Đường dẫn này không có danh tính publisher Authenticode và không thêm mục **Installed apps**.

Sau bất kỳ đường dẫn nào, đăng nhập vào Aura nếu `claude.ai` yêu cầu. Nhấp nút Aura nổi, chọn **Open Studio**, rồi chọn **Themes**.

Tài sản tên `Claude-Aura-Setup-v<version>.exe` không có `-UNSIGNED` là một đường dẫn ký khác và phải hiển thị publisher được nêu trong ghi chú phát hành đó. Tài sản kết thúc bằng `-UNSIGNED-DEV.exe` không bao giờ là công khai.

Cài đặt không cập nhật (patch) hoặc thay thế Claude Desktop.

<details>
<summary><strong>Installer behavior, application location, and uninstall</strong></summary>

Cả hai đường dẫn chạy không có lời nhắc quản trị viên, xác minh yêu cầu tiên quyết và thực hiện phép hoán đổi app-tree có kiểm soát của Aura. Tệp ứng dụng được cài vào:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Nó tạo các shortcut **Claude Aura**, **Claude Aura Studio** và gỡ cài đặt trong menu Start và trên Desktop. Cài đặt theme và dữ liệu đăng nhập được lưu riêng khỏi ứng dụng, vì vậy cài lại Aura sẽ không thay thế im lặng chúng. Native Setup thêm mục **Installed apps** và trình gỡ cài đặt native; đường dẫn ZIP/CMD giữ lại shortcut gỡ cài đặt từ script nguồn của nó.

Các nhà phát triển có thể clone repository và xây dựng installer phát triển unsigned có tên rõ ràng để kiểm tra cục bộ. Nó khác với unsigned Setup công khai đã được đánh dấu rõ ràng. Các lệnh build, compiler pinned, verification gates và checklist release đã được ghi trong
[Windows installer guide](../docs/WINDOWS_INSTALLER.md).

### Uninstall

Đầu tiên nhấp chuột phải vào nút Aura nổi và chọn **Exit Claude Aura**.
Đối với cài đặt ZIP, mở **Start > Claude Aura > Uninstall Claude Aura** hoặc nhấp đúp **Uninstall Claude Aura.cmd** trong một bản release đã giải nén. Với cả hai native Setup, bạn cũng có thể dùng **Settings > Apps > Installed apps > Claude Aura > Uninstall**. Mục `.cmd` ủy quyền cho trình gỡ cài đặt native đã đăng ký khi có. Trình gỡ cài đặt từ chối tiếp tục khi Aura vẫn mở.

Mặc định, uninstall xóa ứng dụng Aura và các shortcut nhưng giữ lại cài đặt theme địa phương và hồ sơ đăng nhập WebView riêng của Aura cho lần cài đặt lại sau này. Trình gỡ cài đặt cũng yêu cầu xác nhận trước khi xóa cả các thư mục đó. Việc xóa tùy chọn này sẽ xóa phiên đăng nhập cục bộ của Aura; nó không bao giờ xóa Claude Desktop, tài khoản Anthropic của người dùng, hoặc dữ liệu tài khoản phía máy chủ.

</details>

<p align="right">(<a href="#readme-top">quay về đầu trang</a>)</p>

<a id="theme-showcase"></a>
## Bộ sưu tập theme

Aura trình bày hệ thống trực quan của mình dưới dạng bản xem trước New chat và Conversation. Xem trước New chat và chủ đề Japanese Film Editorial nổi bật nằm ở đầu file này.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

### Japanese Film Editorial

Giấy cứng ấm, mực than, indigo trầm, và đỏ đỏ gợi nhấn nhá.

<details>
<summary>Xem layout Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>Tối · Conversation · bản trình diễn tài liệu do người dùng cung cấp</sub>
</p>

</details>

### Japanese Idol

Cream ấm, hồng phấn, hồng đậm, tím ánh ngọc trai và chi tiết dải ruy băng tinh tế.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>Sáng · Chat mới · bản trình diễn tài liệu do người dùng cung cấp</sub>
</p>

<details>
<summary>Xem layout Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>Sáng · Conversation · bản trình diễn tài liệu do người dùng cung cấp</sub>
</p>

</details>

### Korean Idol

Trắng lạnh, periwinkle, bạc holographic và lớp kính âm nhạc có cấu trúc.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>Sáng · Chat mới · bản trình diễn tài liệu do người dùng cung cấp</sub>
</p>

<details>
<summary>Xem layout Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>Sáng · Conversation · bản trình diễn tài liệu do người dùng cung cấp</sub>
</p>

</details>

<details>
<summary><strong>Tình trạng tham chiếu và ranh giới tái sử dụng</strong></summary>

> **Tình trạng tham chiếu:** Các ảnh người dùng cung cấp này truyền tải định hướng thị giác đã kỳ vọng.
> Chúng có thể chứa nội dung giao diện minh họa và không phải bằng chứng chấp nhận trực tiếp hoặc minh chứng hành vi hiện tại của `claude.ai`.
> Chúng không phải nền theme, không được nhập vào Aura và không được đưa vào bộ cài phát hành.
>
> Các bản xem trước có giao diện sản phẩm bên thứ ba, tên hoặc nhãn hiệu, và artwork gợi hình ảnh người giống người thật.
> Việc bao gồm chúng không tự cấp quyền sử dụng lại. Hãy xác nhận quyền liên quan trước khi phân phối hoặc xuất bản tiếp.

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>Tất cả theme tích hợp sẵn và ID ổn định</strong></summary>

Aura cung cấp tám theme tích hợp sẵn theo một thứ tự cố định:

| # | Theme | ID ổn định |
| ---: | --- | --- |
| 1 | Default | `default` |
| 2 | Japanese Film Editorial | `japanese-film-editorial` |
| 3 | Korean Prestige | `korean-prestige` |
| 4 | Cartoon Studio | `cartoon-studio` |
| 5 | Anime Twilight | `anime-twilight` |
| 6 | Study Library | `study-library` |
| 7 | Japanese Idol | `japanese-idol` |
| 8 | Korean Idol | `korean-idol` |

Các theme tích hợp sẵn là chỉ đọc. Studio sẽ sao chép thành bản chỉnh sửa được khi bạn muốn tùy biến.

</details>

<p align="right">(<a href="#readme-top">quay về đầu trang</a>)</p>

<a id="use-aura"></a>
## Sử dụng Aura

| Hành động | Công dụng |
| --- | --- |
| Nhấp vào nút Aura nổi | Mở Claude Aura Studio |
| **Themes** | Mở bộ sưu tập tích hợp và lưu theme đã chọn |
| **Create a theme** | Tạo hoặc chỉnh sửa theme tùy chỉnh do Aura sở hữu |
| **Personal wallpaper > Choose wallpaper** | Chọn một ảnh cục bộ riêng với theme đang dùng |
| **Clear wallpaper** | Dừng sử dụng ảnh nền mà không xóa file nguồn |
| **Original look** | Gỡ lớp trình bày Aura và hiển thị site live không có theme đã chọn |
| **Apply theme** | Khôi phục theme Aura đã lưu sau khi bật Original look |
| **Open desktop app** | Mở Claude Desktop mà không chỉnh sửa nó |

Theme đã chọn sẽ được giữ qua lần khởi động lại Aura. **Original look** tắt lớp trình bày Aura; nó không xóa các theme đã lưu hoặc artwork tùy chỉnh.
**Default** là theme tích hợp đầu tiên của Aura; nó không giống Original look.

Nút khởi chạy Aura nổi giữ dạng điều khiển tròn gọn. Nhấp để mở Studio, kéo để di chuyển, hoặc nhấp phải để mở menu Aura.

Hình nền cá nhân vẫn liên kết theo đường dẫn ảnh gốc. Việc di chuyển hoặc xóa file đó sẽ khiến hình nền không còn khả dụng. Artwork nhập qua editor theo một đường dẫn khác: Studio sao chép hoặc chuyển đổi artwork vào thư mục theme thuộc quyền sở hữu của Aura.

<p align="right">(<a href="#readme-top">quay về đầu trang</a>)</p>

<a id="create-a-custom-theme"></a>
## Tạo theme tùy chỉnh

1. Mở **Claude Aura Studio** từ Desktop hoặc Start menu.
2. Mở **Create a theme**, chọn **Customize Default**, hoặc mở **Themes**,
   chọn một theme tích hợp rồi chọn **Duplicate to customize**.
3. Điều chỉnh màu Light và Dark, typography, shapes, effects và artwork cục bộ.
4. Kiểm tra bố cục New chat và Conversation trong bản xem trước của Studio.
5. Xử lý cảnh báo tương phản hoặc giới hạn dung lượng file.
6. Chọn **Save theme**.

Các file tích hợp sẵn không bao giờ bị ghi đè. Nếu một bản nháp không hợp lệ,
nó vẫn có thể chỉnh sửa được trong khi Aura tiếp tục hiển thị phiên bản hợp lệ gần nhất.

Ảnh PNG, JPEG, WebP hoặc AVIF được nhập đều được chuyển đổi cục bộ thành tài sản WebP theo ngân sách. Studio không lưu đường dẫn file nguồn trong theme. Xem
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md) để biết đầy đủ quy trình chỉnh sửa và hợp đồng theme.

Khi có thể, Studio có thể dùng ảnh chụp màn hình của cửa sổ Aura thật làm nền chỉnh sửa.
Ảnh chụp đó có thể chứa nội dung hội thoại, chỉ giữ trong bộ nhớ cho phiên chỉnh sửa hiện tại và không bao giờ ghi ra đĩa.

<p align="right">(<a href="#readme-top">quay về đầu trang</a>)

<a id="built-with"></a>
## Aura hoạt động như thế nào

| Thành phần | Mục đích |
| --- | --- |
| PowerShell và WinForms trên Windows | Trình cài đặt, cửa sổ Aura, Studio, phím tắt và điều khiển cục bộ |
| Microsoft Edge WebView2 | Hiển thị website thực `claude.ai` |
| Node.js 22+ | Kiểm tra theme và dựng styling địa phương |
| HTML, CSS, JavaScript, SVG và WebP cục bộ | Cung cấp styling Aura và tài sản theme tích hợp sẵn |

Dự án không có dependency npm package hay font runtime từ xa.

<p align="right">(<a href="#readme-top">quay về đầu trang</a>)

<a id="safety-and-privacy"></a>
## An toàn và quyền riêng tư

- Aura tải website HTTPS thực tại `claude.ai` trong Microsoft Edge WebView2.
- Các trang đăng nhập của nhà cung cấp không được theme.
- Aura không mở cổng remote-debugging và không vá Claude Desktop.
- Các file theme và artwork được nhập được lưu trong thư mục thuộc Aura tại máy cục bộ.
- Website trực tiếp vẫn kết nối với Anthropic theo bình thường.
- Hồ sơ WebView chứa dữ liệu phiên đăng nhập và cần được bảo vệ.
- Ảnh chụp live-page của Studio chỉ nằm trong bộ nhớ trong phiên chỉnh sửa và không
  lưu ra đĩa.
- Không chọn ảnh nền nhạy cảm; trang live có thể truy cập dữ liệu DOM trong đúng tiến trình của chính nó.
- Việc sử dụng dịch vụ live vẫn chịu điều kiện của [Consumer Terms](https://www.anthropic.com/terms)
  và [Usage Policy](https://www.anthropic.com/legal/aup) của Anthropic.

Đọc [SECURITY.md](./SECURITY.md) để biết ranh giới tin cậy và [Troubleshooting](../docs/TROUBLESHOOTING.md) để biết hướng dẫn đăng nhập, tải, theme, hình ảnh, và trợ giúp WebView2.

<a id="local-data"></a>
<details>
<summary><strong>Thư mục dữ liệu cục bộ và xử lý khi gỡ cài đặt</strong></summary>

Aura tách riêng các thành phần ứng dụng, cài đặt, theme, bản nháp và hồ sơ trình duyệt:

| Đường dẫn | Nội dung |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Ứng dụng Aura đã cài đặt |
| `%LOCALAPPDATA%\ClaudeAura\data` | Cài đặt, logs và trạng thái local do Aura quản lý |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Theme tùy chỉnh đã lưu và artwork đã dẫn xuất |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Các bản nháp đang chỉnh sửa trong Studio |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Hồ sơ đăng nhập WebView2 riêng của Aura |

Hãy coi thư mục `webview` như bất kỳ hồ sơ trình duyệt đã đăng nhập nào. Không phát hành
hay chia sẻ nó. Gỡ cài đặt mặc định giữ lại `data` và `webview`; chọn
xóa thủ công chỉ khi bạn cũng muốn xóa cài đặt local, theme,
và hồ sơ đăng nhập riêng đó.

</details>

<p align="right">(<a href="#readme-top">quay về đầu trang</a>)</p>

<a id="roadmap"></a>
## Lộ trình

- [x] Đồng hành WebView2 Windows riêng và **Original look** có thể hoàn nguyên
- [x] Tám theme tích hợp sẵn ổn định với hỗ trợ Light và Dark
- [ ] Hoàn thành và kiểm duyệt trình soạn visual editor không-code của Studio
- [ ] Hoàn thành và phê duyệt Aura Code cho [Remote Control](https://code.claude.com/docs/en/remote-control) chính thức của Claude Code local, cùng export terminal-theme tương ứng
- [ ] Công bố hướng dẫn tạo theme tùy chỉnh trong 30 phút
- [ ] Thực hiện đợt kiểm tra phê duyệt phát hành cuối cùng

Xem [implementation report](../docs/IMPLEMENTATION_REPORT.md) và
[repository issues](https://github.com/kaihuang1425/claude-aura/issues) để biết trạng thái công khai. Một bản xem trước không thay thế được cho chứng cứ chấp nhận trực tiếp cần thiết của Aura.

<p align="center">(<a href="#readme-top">quay về đầu trang</a>)</p>

<a id="support"></a>
## Hỗ trợ và tài liệu

Bắt đầu với [Troubleshooting](../docs/TROUBLESHOOTING.md). Để báo lỗi hoặc đề xuất tính năng, hãy dùng
[Issues của repository](https://github.com/kaihuang1425/claude-aura/issues).

Khi báo lỗi, bao gồm phiên bản Windows, Node.js, WebView2, ID theme đang dùng và các
bước tái hiện vấn đề. Xem trước khi chia sẻ logs; log UI của Aura được lưu tại:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Báo cáo lỗ hổng bảo mật qua private security advisory như mô tả trong [SECURITY.md](./SECURITY.md).

### Bản đồ tài liệu

- [Troubleshooting](../docs/TROUBLESHOOTING.md)
- [Security và trust boundary](./SECURITY.md)
- [Hướng dẫn theme](../docs/THEMING.md)
- [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)
- [Implementation report](../docs/IMPLEMENTATION_REPORT.md)
- [File Manifest](../docs/FILE_MANIFEST.md)
- [Contribution guide](./CONTRIBUTING.md)
- [Repository issues](https://github.com/kaihuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>Kiểm tra đóng góp và phạm vi dự án</strong></summary>

Chạy các kiểm tra bắt buộc trước khi gửi thay đổi:

```powershell
npm run check
npm run verify:cycle
```

Đối với kiểm tra theme tích hợp sẵn đơn lẻ:

```powershell
node scripts/theme-cli.mjs qa <id>
```

Hãy giữ nguyên các ranh giới dự án:

- Không thêm npm dependency hoặc font runtime.
- Giữ nguyên ID của tám theme ổn định và thứ tự của chúng.
- Không đóng gói HTML giao diện Claude đã tái tạo như nội dung sản phẩm.
- Không gửi ảnh tham chiếu như bằng chứng chấp nhận UI.
- Bao gồm nguồn gốc, giấy phép và thông tin phân phối cho media đóng góp.

Xem [CONTRIBUTING.md](./CONTRIBUTING.md), [Theming guide](../docs/THEMING.md),
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md) và [File Manifest](../docs/FILE_MANIFEST.md) trước khi chỉnh hệ thống theme hoặc cây phát hành.

</details>

<p align="right">(<a href="#readme-top">quay về đầu trang</a>)</p>

<a id="charitable-support"></a>
## Ủng hộ từ thiện

Claude Aura không nhận tài trợ cá nhân, tip, tài trợ, hoa hồng giới thiệu hoặc hỗ trợ tài chính khác.
Chủ sở hữu hiện đang tại Vương quốc Anh theo [điều kiện Student route](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student),
ngăn cản tự doanh hoặc hoạt động kinh doanh trừ một số trường hợp hạn chế. Để tránh xung đột với
những điều kiện này, chủ sở hữu không nhận được quyên góp hay tip liên quan dự án khi quy định còn hiệu lực.

[Nếu Claude Aura hữu ích với bạn, cách đơn giản và không tốn chi phí nhất để hỗ trợ nó là gắn sao cho repository trên GitHub.](https://github.com/kaihuang1425/claude-aura)

<details>
<summary><strong>Bối cảnh student-route, tổ chức phi lợi nhuận độc lập và giới hạn quyên góp</strong></summary>

Những người muốn ủng hộ các hoạt động vì lợi ích công cộng có thể quyên góp trực tiếp cho một
trong các tổ chức phi lợi nhuận độc lập sau:

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  hỗ trợ người bị ảnh hưởng bởi xung đột và thảm họa, gồm cả người tị nạn đang tái thiết
  cuộc sống tại Anh. Mạng lưới rộng hơn của IRC cũng tham gia Claude Corps.
- [CodePath](https://www.every.org/codepath) cung cấp giáo dục kỹ thuật miễn phí và hợp tác với
  Anthropic như đối tác phi lợi nhuận cho [Claude Corps](https://www.anthropic.com/news/claude-corps).

Các liên kết này dẫn trực tiếp đến bên thứ ba. Claude Aura và chủ sở hữu không thu thập,
xử lý, kiểm soát, nhận hoặc hưởng lợi tài chính từ bất kỳ khoản quyên góp nào.
Các tổ chức tự xử lý quy trình đóng góp và biên nhận của họ. Danh sách này không hàm ý liên kết,
được tài trợ, xác nhận, hay hợp tác gây quỹ chính thức với Claude Aura.

</details>

<a id="license-and-notices"></a>
## Giấy phép và thông báo

Phần mềm do dự án tạo ra được phân phối theo [MIT License](./LICENSE).
Xem thêm [NOTICE.md](./NOTICE.md) và [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

MIT License không cấp quyền đối với tên, nhãn hiệu, giao diện web hoặc ứng dụng của Anthropic.
Chú thích bản xem trước không cấp quyền tái sử dụng UI hiển thị, artwork, tên, nhãn hiệu hoặc
hình ảnh nhận dạng người. Các thông báo quyền sở hữu và nguồn theo file vẫn áp dụng.

Xem [Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
và [Consumer Terms](https://www.anthropic.com/terms) mới nhất.
Trước khi đăng tải, chỉnh sửa hoặc phân phối lại tên, nhãn hiệu, bản chụp giao diện, artwork hay
hình ảnh nhận diện được bảo hộ, hãy xin phép chủ sở hữu quyền liên quan.
Repository và README này không cấp phép đó.

<a id="acknowledgments"></a>
## Lời cảm ơn

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) đã định hình lại quy trình xác thực loopback ban đầu và mẫu showcase dễ tiếp cận.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin)
  giúp định hình mapping theme ngữ nghĩa giai đoạn đầu.
- [Best README Template](https://github.com/othneildrew/Best-README-Template)
  giúp xây dựng cấu trúc đọc ưu tiên cho README này.
- Microsoft Edge WebView2 cung cấp runtime trình duyệt nhúng.

Giấy phép và nguồn gốc chi tiết nằm trong
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). Việc ghi nhận không hàm ý liên kết,
tài trợ hay ủng hộ.

<p align="right">(<a href="#readme-top">quay về đầu trang</a>)</p>
