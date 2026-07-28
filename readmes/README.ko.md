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
  <strong>한국어</strong> ·
  <a href="./README.pt-BR.md">Português (Brasil)</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.it.md">Italiano</a> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Windows에서 실시간 Claude 웹사이트에 개인화되고 되돌릴 수 있는 테마를 적용하세요.</strong><br>
  로컬 테마 · Claude Desktop 패치 없음 · 원래 모습으로 한 번에 되돌리기
</p>

<p align="center">
  <a href="#getting-started">시작하기</a> ·
  <a href="#theme-showcase">테마 보기</a> ·
  <a href="#create-a-custom-theme">테마 만들기</a> ·
  <a href="../docs/TROUBLESHOOTING.md">문제 해결</a> ·
  <a href="./SECURITY.md">보안</a>
</p>

<p align="center">
  <a href="https://github.com/kaihuang1425/claude-aura"><strong>Claude Aura가 유용하다면, GitHub에서 이 프로젝트에 별표를 눌러주세요.</strong></a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>다크 · 새 대화 · 사용자 제공 문서 쇼케이스</sub>
</p>

<p align="center"><sub>참조 미리보기 · 가져온 테마 배경이나 라이브 승인 증거가 아닙니다</sub></p>

> **Independent project.** Claude Aura는 독립 프로젝트이며 Anthropic PBC와 제휴되거나 승인되거나 후원되지 않습니다. Aura는 `claude.ai`에서 라이브 웹사이트를 표시할 뿐, Claude 또는 Anthropic 설치 앱을 제공하거나 수정하지 않습니다. Claude, Anthropic 및 관련 이름과 상표는 Anthropic PBC의 자산입니다. 프로젝트 라이선스는 이 자료에 대한 사용권을 부여하지 않습니다.

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
<summary><strong>목차</strong></summary>

- [Claude Aura](#claude-aura)
  - [Aura 소개](#aura-소개)
  - [빠른 시작](#빠른-시작)
    - [요구 사항](#요구-사항)
    - [설치](#설치)
    - [제거](#제거)
  - [테마 쇼케이스](#테마-쇼케이스)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Aura 사용하기](#aura-사용하기)
  - [맞춤 테마 만들기](#맞춤-테마-만들기)
  - [Aura 작동 방식](#aura-작동-방식)
  - [보안 및 개인정보 보호](#보안-및-개인정보-보호)
  - [로드맵](#로드맵)
  - [지원 및 문서](#지원-및-문서)
    - [문서 맵](#문서-맵)
  - [기부 지원](#기부-지원)
  - [라이선스 및 고지](#라이선스-및-고지)
  - [감사의 말](#감사의-말)

</details>
<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Aura 소개

- **실시간 Claude 사이트를 사용합니다.** Aura는 재구성된 스크린으로 바꾸지 않고 실제 인터페이스와 기본 컨트롤을 유지합니다.
- **로컬 및 되돌릴 수 있는 변경.** Claude Desktop을 패치하지 않고 로컬 스타일을 적용하며, **Original look**로 한 번에 Aura 표현 레이어를 제거할 수 있습니다.
- **8개의 기본 테마로 시작.** 각 테마는 안정적이고 읽기 전용인 시작점입니다.
- **원본 테마를 덮어쓰지 않고 커스텀 테마를 만듭니다.** Claude Aura Studio는 로컬 색상, 타이포그래피, 형태, 효과, 아트워크를 지원합니다.

Aura 0.3는 현재 실시간 사이트에만 테마를 적용합니다. 아직 네이티브 Claude Desktop Code 또는 Claude Code 터미널은 지원하지 않으며, Aura 내부의 일반 채팅은 로컬 프로젝트 접근을 얻지 못합니다. 최종 릴리스 이전에 Aura Code는 실시간 `claude.ai/code`의 테마 적용 공식
[Remote Control](https://code.claude.com/docs/en/remote-control) 세션에서 릴리스 차단 증명 테스트를 통과해야 합니다; 해당 terminal-theme export는 Claude Desktop을 패치하지 않은 제한 환경에서 사용됩니다.

<details>
<summary><strong>전체 기능 및 제외 항목</strong></summary>

Claude Aura는 실시간 `claude.ai` 사이트를 전용 Microsoft Edge WebView2 창에서 열고 로컬 시각 테마를 적용합니다. 이는 Claude Desktop을 패치하지 않고 스크린샷으로 교체하지 않으면서 더 개인화된 작업 공간을 원하는 사용자용입니다.

| Aura가 수행 | Aura가 수행하지 않음 |
| --- | --- |
| WebView2에서 실시간 `claude.ai` 인터페이스를 로드 | 재구성된 인터페이스로 Claude 교체 |
| 되돌릴 수 있는 로컬 스타일 적용 | Claude Desktop, `app.asar`, Windows 패키지, 코드 서명 패치 |
| 8개 기본 테마 포함 | Claude 계정, 채팅, API 키, 모델, 제공자 설정 변경 |
| 로컬 맞춤 테마용 Studio 제공 | Anthropic 공식 제품/테마 시스템으로 주장 |
| 앱 내 **Original look** 제공 | 스타일이 꺼질 때 저장 테마 삭제 |

</details>

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>
<a id="getting-started"></a>
## 빠른 시작

<a id="requirements"></a>
### 요구 사항

- Windows 10 또는 Windows 11
- 인터넷 액세스 및 Claude 계정
- [Node.js 22 이상](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2는 대부분 최신 Windows에 기본 탑재되어 있습니다. Aura가 브라우저 창을 열지 못하면 Evergreen WebView2 Runtime을 설치 또는 복구하고 다시 시도하세요.
Claude Desktop은 선택 사항이며 별도 애플리케이션입니다.

<a id="installation"></a>
### 설치

[최신 릴리스](https://github.com/kaihuang1425/claude-aura/releases)를 열고 다음 경로 중 하나를 선택하세요. 두 경로 모두 현재 Windows 계정에 동일한 버전을 설치합니다.

| Path | Use it when | Download |
| --- | --- | --- |
| **Unsigned Setup** | 더 단순한 안내형 설치 프로그램이 필요하고 Windows가 이를 정상적으로 열 때 | `Claude-Aura-Setup-v<version>-UNSIGNED.exe` 와 해당 `.sha256`, `.manifest.json` |
| **ZIP + CMD fallback** | Windows가 unsigned Setup에 경고를 표시하거나 차단할 때, 또는 가독성 있는 소스 스크립트를 선호할 때 | `claude-aura-v<version>.zip` 와 해당 `.sha256` |

#### Path 1 ??Unsigned Setup

1. **Assets**에서 `-UNSIGNED.exe`와 `.sha256`, `.manifest.json`을 다운로드하세요. GitHub가 자동으로 생성한 **Source code** 아카이브는 사용하지 마세요.
2. Setup 파일의 SHA-256을 companion 파일 두 개와 비교합니다. 값이 다르면 다운로드를 중단하고 두 파일을 모두 삭제하세요.
3. 이 설치 프로그램의 publisher는 개발자가 코드 서명 인증서를 가지고 있지 않아 Windows가 확인할 수 없습니다. Windows에서 경고가 표시되거나 차단하면 경고를 우회하지 말고 Path 2를 사용하세요.
4. 정상적으로 열리면 Setup을 따르세요. Node.js와 WebView2를 확인하고 `%LOCALAPPDATA%\ClaudeAura` 아래에 설치한 뒤 **Installed apps** 등록과 바로가기를 추가하고 Aura를 실행합니다.

#### Path 2 ??ZIP + CMD fallback

1. **Assets**에서 `claude-aura-v<version>.zip`와 일치하는 `.sha256`를 다운로드하세요. GitHub가 자동으로 생성한 **Source code** 아카이브는 사용하지 마세요.
2. ZIP의 SHA-256을 companion 파일과 비교합니다. 값이 다르면 중단하고 두 파일을 모두 삭제하세요.
3. **Extract all**을 선택하세요. 추출된 `claude-aura` 폴더에서 **Install Claude Aura.cmd**를 더블 클릭합니다. ZIP 미리보기에서 실행하지 마세요.
4. 읽을 수 있는 CMD/PowerShell 설치기는 Node.js와 WebView2를 확인하고 Aura를 설치한 다음 바로가기를 만들고 열어줍니다. 이 경로에는 Authenticode publisher identity가 없으며 **Installed apps** 항목을 추가하지 않습니다.

어느 경로를 사용하든 `claude.ai`가 요청할 경우 Aura에 로그인하세요. 떠 있는 Aura 버튼을 클릭한 다음 **Open Studio**를 선택하고 **Themes**를 선택하세요.

`-UNSIGNED`가 없는 `Claude-Aura-Setup-v<version>.exe`는 별도의 signed path이며, 해당 릴리스 노트에 명시된 publisher가 표시되어야 합니다. `-UNSIGNED-DEV.exe`로 끝나는 asset은 공개되지 않습니다.

설치는 Claude Desktop을 패치하거나 대체하지 않습니다.

<details>
<summary><strong>Installer behavior, application location, and uninstall</strong></summary>

두 경로 모두 관리자 프롬프트 없이 실행되고, 필수 구성 요소를 검증한 뒤 Aura의 가드된 앱 트리 교체를 수행합니다. 앱 파일은 다음 위치에 설치됩니다.

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Start 메뉴와 데스크톱에 **Claude Aura**, **Claude Aura Studio**, 그리고 제거 바로가기를 만듭니다. 테마 설정과 로그인 데이터는 앱과 분리 저장되므로 Aura를 재설치해도 조용히 바뀌지 않습니다. 네이티브 Setup은 **Installed apps** 항목과 네이티브 제거자를 추가합니다; ZIP/CMD 경로는 소스 스크립트 제거 바로가기를 유지합니다.

개발자는 저장소를 클론하고 로컬 검사용으로 명시적으로 이름 지정된 unsigned 개발자 설치 프로그램을 빌드할 수 있습니다. 이는 공개되지 않은 unsigned Setup와 구분됩니다. 빌드 명령, pinned 컴파일러, 검증 게이트 및 릴리스 체크리스트는
[Windows installer guide](../docs/WINDOWS_INSTALLER.md)에 문서화되어 있습니다.

### Uninstall

먼저 떠 있는 Aura 버튼을 오른쪽 클릭하고 **Exit Claude Aura**를 선택하세요.
ZIP 설치에서는 **Start > Claude Aura > Uninstall Claude Aura**를 열거나 추출된 릴리스의 **Uninstall Claude Aura.cmd**를 더블 클릭합니다. 두 native Setup 모두에 대해 **Settings > Apps > Installed apps > Claude Aura > Uninstall**도 사용할 수 있습니다. `.cmd` 항목은 존재할 때 등록된 native uninstaller로 위임합니다. Uninstaller는 Aura가 아직 열려 있는 동안 계속되지 않습니다.

기본적으로 uninstall은 Aura 앱과 바로가기를 삭제하지만, 향후 재설치를 위해 로컬 테마 설정과 Aura의 별도 WebView 로그인 프로필은 유지합니다. Uninstaller는 이러한 폴더를 삭제하기 전에도 확인을 요청합니다. 이 선택적 삭제는 Aura의 로컬 로그인 세션을 제거합니다. Claude Desktop, 사용자 Anthropic 계정 또는 서버 측 계정 데이터를 삭제하지 않습니다.

</details>
<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<a id="theme-showcase"></a>
## 테마 쇼케이스

Aura의 시각 시스템은 New chat과 Conversation 참조를 통해 아래에서 보여집니다. README 맨 위에는
Japanese Film Editorial New chat 참조 미리보기가 표시됩니다.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

<a id="japanese-film-editorial"></a>
### Japanese Film Editorial

따뜻한 종이, 목탄 잉크, 차분한 인디고, 절제된 진홍색.

<details>
<summary>Conversation 뷰 보기</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>다크 · Conversation · 사용자 제공 문서 쇼케이스</sub>
</p>

</details>

<a id="japanese-idol"></a>
### Japanese Idol

따뜻한 크림, 블러시, 장미색, 진주빛 라일락, 그리고 섬세한 리본 디테일.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>라이트 · 새 채팅 · 사용자 제공 문서 쇼케이스</sub>
</p>

<details>
<summary>Conversation 뷰 보기</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>라이트 · Conversation · 사용자 제공 문서 쇼케이스</sub>
</p>

</details>

<a id="korean-idol"></a>
### Korean Idol

차가운 흰색, 페리윙클, 홀로그래픽 실버, 구조화된 뮤직 글라스.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>라이트 · 새 채팅 · 사용자 제공 문서 쇼케이스</sub>
</p>

<details>
<summary>Conversation 뷰 보기</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>라이트 · Conversation · 사용자 제공 문서 쇼케이스</sub>
</p>

</details>

<details>
<summary><strong>참조 상태 및 재사용 범위</strong></summary>

> **참조 상태:** 이 사용자 제공 이미지는 의도된 시각적 방향을 보여줍니다.
> 예시 UI 콘텐츠가 포함될 수 있으며, 현재 `claude.ai` 동작의 라이브 승인 증거나
> 실시간 동작 증명이 아닙니다. 테마 배경이 아니며 Aura로 가져오면 안 되며 릴리스
> 설치 프로그램에서도 제외됩니다.
>
> 이 미리보기에는 타사 제품 UI, 이름/상표, 사람을 닮은 초상 아트워크가 포함될 수 있습니다.
> 포함되어 있어도 재사용 권한이 생기는 것은 아닙니다. 공개 또는 재배포 전 인터페이스,
> 상표, 아트워크, 유사 인격의 권한을 확인하세요.

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>모든 기본 테마와 안정적 ID</strong></summary>

Aura는 고정 순서로 8개 기본 테마를 제공합니다.

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

기본 테마는 읽기 전용입니다. Studio에서 커스터마이징하려면 편집 가능한 복사본을 만듭니다.

</details>

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>
<a id="use-aura"></a>
## Aura 사용하기

| 동작 | 내용 |
| --- | --- |
| 떠 있는 Aura 버튼 클릭 | Claude Aura Studio를 엽니다 |
| **Themes** | 기본 갤러리를 열고 선택한 테마를 저장 |
| **Create a theme** | Aura 전용 커스텀 테마 생성 또는 편집 |
| **Personal wallpaper > Choose wallpaper*** | 현재 테마와 별도로 로컬 이미지를 선택 |
| **Clear wallpaper** | 소스 파일을 삭제하지 않고 배경화면 해제 |
| **Original look** | Aura 스타일을 제거하고 선택 테마 없이 라이브 사이트 표시 |
| **Apply theme** | Original look 후 저장된 Aura 테마 복원 |
| **Open desktop app** | Claude Desktop을 변경하지 않고 엽니다 |

선택한 테마는 Aura 재시작 후에도 유지됩니다. **Original look**은 Aura의 표현 레이어를 껍니다.
저장 테마나 사용자 아트워크는 삭제되지 않습니다. **Default**는 Aura의 첫 번째 기본 테마이며 Original look과 다릅니다.

떠 있는 Aura 런처는 작고 원형인 컨트롤로 유지됩니다. 클릭해 Studio를 열고, 끌어 이동하거나,
오른쪽 클릭으로 Aura 메뉴를 엽니다.

Personal wallpaper는 원본 이미지 경로와 연결됩니다. 해당 파일을 이동하거나 삭제하면 배경화면이 더 이상 사용 불가합니다.
에디터로 가져온 아트워크는 별도 경로를 사용하며, Studio가 Aura 소유 테마 폴더에 복사/변환합니다.

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<a id="create-a-custom-theme"></a>
## 맞춤 테마 만들기

1. 데스크톱 또는 시작 메뉴에서 **Claude Aura Studio**를 엽니다.
2. **Create a theme**를 열고 **Customize Default**를 선택하거나, **Themes**에서 기본 항목을 골라 **Duplicate to customize**를 선택합니다.
3. Light 및 Dark 색상, 타이포그래피, 형태, 효과, 로컬 아트워크를 조정합니다.
4. Studio 미리보기에서 New chat과 Conversation 배치를 확인합니다.
5. 대비나 파일 크기 경고를 해결합니다.
6. **Save theme**를 선택합니다.

기본 파일은 절대 덮어쓰지 않습니다. 드래프트가 유효하지 않아도 Aura는 마지막 유효 버전을 표시하며, 해당 드래프트는 계속 편집 가능합니다.

가져온 PNG, JPEG, WebP, AVIF 아트워크는 로컬에서 예산이 적용된 WebP 에셋으로 변환됩니다. Studio는 테마 내부에 원본 파일 경로를 저장하지 않습니다.
전체 에디터 및 테마 계약은 [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)을 참고하세요.

사용 가능한 경우 Studio는 실제 Aura 창 캡처를 편집 백드롭으로 사용할 수 있습니다.
이 캡처는 대화 내용을 포함할 수 있으며, 현재 편집 세션 메모리에서만 유지되고 디스크에 기록되지 않습니다.

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<a id="built-with"></a>
<a id="how-aura-works"></a>
## Aura 작동 방식

| 구성 요소 | 용도 |
| --- | --- |
| Windows PowerShell 및 WinForms | 설치, Aura 창, Studio, 바로가기, 로컬 컨트롤 |
| Microsoft Edge WebView2 | 실시간 `claude.ai` 사이트 표시 |
| Node.js 22+ | 테마 검증 및 로컬 테마 스타일 생성 |
| 로컬 HTML, CSS, JavaScript, SVG, WebP | Aura 스타일 및 기본 테마 자산 제공 |

이 프로젝트는 npm 런타임 패키지나 외부 폰트 의존성을 추가하지 않습니다.

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<a id="safety-and-privacy"></a>
## 보안 및 개인정보 보호

- Aura는 Microsoft Edge WebView2로 실시간 HTTPS `claude.ai`를 로드합니다.
- 로그인 제공자 페이지는 테마가 적용되지 않습니다.
- Aura는 remote-debugging 포트를 열지 않거나 Claude Desktop을 패치하지 않습니다.
- 테마 파일과 가져온 아트워크는 Aura 로컬 폴더에 저장됩니다.
- 실시간 웹페이지는 여전히 Anthropic에 정상 연결됩니다.
- WebView 프로필에는 로그인 세션 데이터가 있어 보호가 필요합니다.
- Studio 라이브 페이지 캡처는 편집 세션 메모리에서만 유지되며 디스크에 저장되지 않습니다.
- 민감한 배경 이미지를 선택하지 마세요. 실시간 페이지는 기술적으로 자체 프로세스의 DOM 데이터에 접근할 수 있습니다.
- 라이브 서비스 사용은 Anthropic의 현재 [Consumer Terms](https://www.anthropic.com/terms) 및 [Usage Policy](https://www.anthropic.com/legal/aup)에 따릅니다.

신뢰 경계는 [SECURITY.md](./SECURITY.md)에서, 로그인/로딩/테마/이미지/WebView2 도움말은 [Troubleshooting](../docs/TROUBLESHOOTING.md)에서 확인하세요.

<a id="local-data"></a>
<details>
<summary><strong>로컬 데이터 폴더 및 삭제 시 보존 항목</strong></summary>

Aura는 앱, 설정, 테마, 초안, 브라우저 프로필을 분리합니다:

| Path | Contents |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | 설치된 Aura 앱 |
| `%LOCALAPPDATA%\ClaudeAura\data` | 설정, 로그, Aura 로컬 상태 |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | 저장된 커스텀 테마 및 유도 아트워크 |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | 진행 중인 Studio 초안 |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Aura 독립 WebView2 로그인 프로필 |

`webview` 폴더는 로그인된 브라우저 프로필처럼 취급하십시오. 공개하거나 공유하지 마십시오. 기본 제거 동작은 `data`와 `webview`를 유지하며, 이러한 로컬 설정/테마/로그인 프로필도 지우려면 명시 삭제 옵션을 선택하세요.

</details>

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>
<a id="roadmap"></a>
## 로드맵

- [x] 전용 Windows WebView2 동반자 및 되돌릴 수 있는 **Original look**
- [x] Light 및 Dark 지원이 포함된 8개 안정적 기본 테마
- [ ] **P0** 로컬 공식 Claude Code Remote Control용 Aura Code 완성 및 승인, 터미널 테마 export 일치
- [ ] 노코드 Studio 시각 편집기 완성 및 리뷰
- [ ] 30분 커스텀 테마 튜토리얼 게시
- [ ] 최종 릴리스 검증 스윕 실행

자세한 공개 상태는 [implementation report](../docs/IMPLEMENTATION_REPORT.md)와
[repository issues](https://github.com/kaihuang1425/claude-aura/issues)에서 확인하세요.
참조 미리보기는 필수 실시간 Aura 승인 증거를 대체하지 않습니다.

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<a id="support"></a>
## 지원 및 문서

[문제 해결](../docs/TROUBLESHOOTING.md)로 시작하세요. 재현 가능한 버그나 기능 요청은
[저장소 Issue 페이지](https://github.com/kaihuang1425/claude-aura/issues)로 제출하세요.

버그 리포트에는 Windows, Node.js, WebView2 버전, 현재 활성 테마 ID 및 재현 단계가 필요합니다.
공유 전 로그를 확인하세요. Aura UI 로그는 다음 위치에 있습니다:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

보안 이슈는 [SECURITY.md](./SECURITY.md)에 설명된 대로 private repository security advisory를 통해 보고하세요.

<a id="documentation-map"></a>
### 문서 맵

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
<summary><strong>기여 점검 및 프로젝트 경계</strong></summary>

변경 제출 전 필수 점검을 실행하세요.

```powershell
npm run check
npm run verify:cycle
```

단일 기본 테마 감사:

```powershell
node scripts/theme-cli.mjs qa <id>
```

다음 프로젝트 경계는 유지되어야 합니다:

- npm 또는 런타임 폰트 의존성 추가 금지
- 8개 안정적 테마 ID와 순서를 변경하지 않음
- 재구성한 Claude 인터페이스 HTML을 제품 콘텐츠로 배포하지 않음
- 참조 이미지를 UI 승인 증거로 제출하지 않음
- 기여한 미디어의 출처, 라이선스, 배포 정보 포함

[CONTRIBUTING.md](./CONTRIBUTING.md), [Theming guide](../docs/THEMING.md),
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md), [File Manifest](../docs/FILE_MANIFEST.md)을
테마 시스템이나 릴리스 트리 변경 전에 확인하세요.

</details>

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>

<a id="charitable-support"></a>
## 기부 지원

Claude Aura는 개인 기부, 팁, 스폰서십, 추천 결제 또는 기타 금전적 지원을 받지 않습니다.
소유자는 현재 영국 내
[Student route conditions](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student)
의 적용을 받고 있으며, 제한된 조건이 아닌 한 자영업이나 비즈니스 활동이 금지됩니다.
이 조건이 적용되는 동안 프로젝트 관련 기부나 팁은 받을 수 없습니다.

[Claude Aura가 유용하다면, 이를 지원하는 가장 간단한 비금전적 방법은 GitHub에서 저장소에 별을 주는 것입니다.](https://github.com/kaihuang1425/claude-aura)

<details>
<summary><strong>Student-route 맥락, 독립 비영리단체, 기부 경계</strong></summary>

관련 공익 활동을 지원하고 싶은 독자는 다음 독립 비영리단체에 직접 기부할 수 있습니다.

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  분쟁과 재해의 영향을 받은 사람들, 영국에서 재정착 중인 난민을 돕습니다.
  더 넓은 범위의 International Rescue Committee는 [Claude Corps](https://www.anthropic.com/news/claude-corps)에도 참여합니다.
- [CodePath](https://www.every.org/codepath)는 무료 기술 교육을 제공하며,
  [Claude Corps](https://www.anthropic.com/news/claude-corps)와 Anthropic의 비영리 파트너로 활동합니다.

이 링크는 직접 제3자 페이지로 이동합니다. Claude Aura와 소유자는 기부를 수집, 처리,
관리, 수령 또는 수익으로 이익을 얻지 않습니다. 각 조직이 자체 기부 처리 및 영수증 발행을
담당합니다. 이 나열은 Claude Aura의 제휴, 스폰서십, 승인, 공식 모금 파트너십을 의미하지 않습니다.

</details>

<a id="license-and-notices"></a>
## 라이선스 및 고지

프로젝트 제작 소프트웨어는 [MIT License](./LICENSE)로 배포됩니다.
[NOTICE.md](./NOTICE.md)와 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)도 확인하세요.

MIT License는 Anthropic의 이름, 상표, 인터페이스, 웹사이트 또는 앱에 대한 권한을 부여하지 않습니다.
쇼케이스 캡션은 표시 UI, 아트워크, 이름, 상표, 인간 유사성 표현의 재사용 권한을 부여하지 않습니다.
파일별 출처 및 권리 고지는 계속 적용됩니다.

현재 [Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines) 및
[Consumer Terms](https://www.anthropic.com/terms)를 검토하세요. 공개, 수정, 재배포 시
관련 권리자의 허가를 받으십시오. 이 저장소와 README는 해당 허가를 제공하지 않습니다.

<a id="acknowledgments"></a>
## 감사의 말

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin)은 초기 루프백
  검증 워크플로우와 접근 가능한 쇼케이스 패턴을 영감했습니다.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin)은 초기
  의미론적 테마 매핑을 영감했습니다.
- [Best README Template](https://github.com/othneildrew/Best-README-Template)과
  [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)는 이 README의 구조를 영감했습니다.
- Microsoft Edge WebView2는 내장 브라우저 런타임을 제공합니다.

자세한 라이선스와 provenance는 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)에 있습니다.
감사는 제휴·스폰서십·승인을 의미하지 않습니다.

<p align="right">(<a href="#readme-top">맨 위로</a>)</p>
