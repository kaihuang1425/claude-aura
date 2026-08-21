#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <dwmapi.h>
#include <d3d11.h>
#include <d3dcompiler.h>
#include <dxgi1_2.h>
#include <wincodec.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <winrt/base.h>
#include <wrl/client.h>

#include <algorithm>
#include <atomic>
#include <charconv>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cwctype>
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include <exception>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

using Microsoft::WRL::ComPtr;
using namespace std::chrono_literals;
using namespace winrt;
using namespace winrt::Windows::Graphics;
using namespace winrt::Windows::Graphics::Capture;
using namespace winrt::Windows::Graphics::DirectX;
using namespace winrt::Windows::Graphics::DirectX::Direct3D11;

namespace {

constexpr wchar_t kWindowClass[] = L"ClaudeAuraDesktopCaptureFilter";
constexpr UINT_PTR kTrackTimer = 1;

struct Options {
  HWND target{};
  DWORD targetProcessId{};
  std::chrono::milliseconds duration{30000};
  float accent[3]{0.62f, 0.45f, 0.86f};
  float focus[3]{0.62f, 0.45f, 0.86f};
  float accentText[3]{0.98f, 0.98f, 1.0f};
  float border[3]{0.46f, 0.46f, 0.52f};
  float sidebar[3]{0.18f, 0.18f, 0.24f};
  float sidebarText[3]{0.94f, 0.94f, 0.97f};
  float sidebarTextMuted[3]{0.68f, 0.68f, 0.74f};
  float text[3]{0.94f, 0.94f, 0.97f};
  float textSecondary[3]{0.76f, 0.76f, 0.82f};
  float textMuted[3]{0.58f, 0.58f, 0.64f};
  float surface[3]{0.12f, 0.12f, 0.17f};
  float raised[3]{0.18f, 0.18f, 0.24f};
  float canvas[3]{0.08f, 0.08f, 0.12f};
  float strength{0.24f};
  float surfaceAlpha{0.90f};
  float sidebarAlpha{0.88f};
  std::wstring backgroundPath;
  std::wstring featurePath;
  float backgroundOpacity{};
  float featureOpacity{};
  unsigned int backgroundPosition{};
  unsigned int featurePosition{};
  unsigned int featureRole{};
  unsigned int featureMask{};
  float sidebarRatio{0.29f};
  float titleRatio{0.08f};
  float featureMaximumWidthRatio{0.48f};
  float featureMaximumHeightRatio{0.84f};
  float greetingRect[4]{};
  float greetingDestinationRect[4]{};
  unsigned int greetingWeight{400};
  unsigned int greetingFont{};
  float greetingMarkScale{1.0f};
  bool greeting{};
  bool greetingAccent{};
  bool greetingItalic{};
  bool greetingCompactMark{};
  bool landing{};
  bool dark{};
  bool sourceDark{};
  std::wstring stopEventName;
  std::wstring readyEventName;
};

struct ShaderConstants {
  float accent[4];
  float focus[4];
  float accentText[4];
  float border[4];
  float sidebar[4];
  float sidebarText[4];
  float sidebarTextMuted[4];
  float text[4];
  float textSecondary[4];
  float textMuted[4];
  float surface[4];
  float raised[4];
  float canvas[4];
  float strength;
  float dark;
  float surfaceAlpha;
  float sidebarAlpha;
  float sourceDark;
  float padding[3];
  float backgroundOpacity;
  float featureOpacity;
  float backgroundPosition;
  float featurePosition;
  float featureRole;
  float featureMask;
  float landing;
  float sidebarRatio;
  float titleRatio;
  float backgroundAvailable;
  float featureAvailable;
  float featureMaximumWidthRatio;
  float featureMaximumHeightRatio;
  float featurePadding[3];
  float greetingRect[4];
  float greetingDestinationRect[4];
  float greetingActive;
  float greetingColorRole;
  float greetingWeight;
  float greetingItalic;
  float greetingFont;
  float greetingMarkSource;
  float greetingMarkScale;
  float greetingPadding;
};

struct Evidence {
  std::atomic<uint64_t> frames{};
  std::atomic<uint64_t> droppedFrames{};
  std::atomic<uint32_t> captureWidth{};
  std::atomic<uint32_t> captureHeight{};
  std::atomic<uint32_t> swapChainWidth{};
  std::atomic<uint32_t> swapChainHeight{};
  std::atomic<uint32_t> outputClientWidth{};
  std::atomic<uint32_t> outputClientHeight{};
  std::atomic<bool> gpuPixelTransform{};
  std::atomic<bool> stopRequested{};
  std::atomic<bool> readySignaled{};
  std::atomic<bool> dpiAwarenessPerMonitorV2{};
  std::atomic<bool> nativeResolutionPreserved{};
  bool captureSupported{};
  bool exactHwndIsolation{};
  bool borderlessRequested{};
  bool borderlessApplied{};
  bool surfacePaletteMapping{};
  bool semanticPaletteMapping{};
  bool surfaceAlphaMapping{};
  bool sourceAppearanceSampling{};
  bool darkNeutralRemap{};
  bool coverageSafeAffineMapping{};
  bool artworkCompositing{};
  bool backgroundArtworkLoaded{};
  bool featureArtworkLoaded{};
  bool inputTransparent{};
  bool cleanupComplete{};
  bool targetClosed{};
};

Options g_options;
Evidence g_evidence;
HWND g_overlay{};
HANDLE g_stopEvent{};
HANDLE g_readyEvent{};
std::atomic<bool> g_running{true};

std::wstring_view NextArgument(int& index, int argc, wchar_t** argv) {
  if (++index >= argc) throw std::runtime_error("missing argument value");
  return argv[index];
}

uint64_t ParseUnsigned(std::wstring_view value) {
  uint64_t result{};
  if (value.empty()) throw std::runtime_error("invalid unsigned argument");
  for (const wchar_t character : value) {
    if (character < L'0' || character > L'9') {
      throw std::runtime_error("invalid unsigned argument");
    }
    const uint64_t digit = static_cast<uint64_t>(character - L'0');
    if (result > (UINT64_MAX - digit) / 10) {
      throw std::runtime_error("invalid unsigned argument");
    }
    result = result * 10 + digit;
  }
  return result;
}

float ParseUnitFloat(std::wstring_view value, float maximum) {
  std::wstring owned(value);
  wchar_t* end{};
  const float result = std::wcstof(owned.c_str(), &end);
  if (!end || end != owned.c_str() + owned.size() || !std::isfinite(result) ||
      result < 0.0f || result > maximum) {
    throw std::runtime_error("invalid floating-point argument");
  }
  return result;
}

unsigned int ParseBoundedUnsigned(
    std::wstring_view value, unsigned int maximum, const char* error) {
  const uint64_t parsed = ParseUnsigned(value);
  if (parsed > maximum) throw std::runtime_error(error);
  return static_cast<unsigned int>(parsed);
}

bool ValidArtworkPath(const std::wstring& path) {
  if (path.empty() || path.size() >= 32768 || path.find(L'"') != std::wstring::npos) {
    return false;
  }
  const DWORD attributes = GetFileAttributesW(path.c_str());
  if (attributes == INVALID_FILE_ATTRIBUTES
      || (attributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT))) {
    return false;
  }
  const size_t extension = path.find_last_of(L'.');
  if (extension == std::wstring::npos) return false;
  std::wstring suffix = path.substr(extension);
  std::transform(suffix.begin(), suffix.end(), suffix.begin(), [](wchar_t character) {
    return static_cast<wchar_t>(std::towlower(character));
  });
  return suffix == L".webp" || suffix == L".png";
}

void ParseColor(std::wstring_view value, float (&color)[3]) {
  if (value.size() != 7 || value.front() != L'#') {
    throw std::runtime_error("color must be #RRGGBB");
  }
  for (size_t channel = 0; channel < 3; ++channel) {
    const auto nibble = [](wchar_t character) -> unsigned int {
      if (character >= L'0' && character <= L'9') return character - L'0';
      if (character >= L'a' && character <= L'f') return character - L'a' + 10;
      if (character >= L'A' && character <= L'F') return character - L'A' + 10;
      throw std::runtime_error("color must be #RRGGBB");
    };
    const unsigned int parsed = nibble(value[1 + channel * 2]) * 16
        + nibble(value[2 + channel * 2]);
    color[channel] = static_cast<float>(parsed) / 255.0f;
  }
}

bool ValidOwnedEventName(std::wstring_view value, std::wstring_view prefix) {
  if (!value.starts_with(prefix) || value.size() != prefix.size() + 32) return false;
  return std::all_of(value.begin() + prefix.size(), value.end(), [](wchar_t character) {
    return (character >= L'0' && character <= L'9')
        || (character >= L'A' && character <= L'F');
  });
}

Options ParseOptions(int argc, wchar_t** argv) {
  Options options;
  for (int index = 1; index < argc; ++index) {
    const std::wstring_view argument = argv[index];
    if (argument == L"--target-hwnd") {
      const auto raw = ParseUnsigned(NextArgument(index, argc, argv));
      options.target = reinterpret_cast<HWND>(static_cast<uintptr_t>(raw));
    } else if (argument == L"--duration-ms") {
      const auto raw = ParseUnsigned(NextArgument(index, argc, argv));
      if (raw != 0 && (raw < 1000 || raw > 600000)) {
        throw std::runtime_error("duration out of range");
      }
      options.duration = std::chrono::milliseconds(raw);
    } else if (argument == L"--accent") {
      ParseColor(NextArgument(index, argc, argv), options.accent);
    } else if (argument == L"--focus") {
      ParseColor(NextArgument(index, argc, argv), options.focus);
    } else if (argument == L"--accent-text") {
      ParseColor(NextArgument(index, argc, argv), options.accentText);
    } else if (argument == L"--border") {
      ParseColor(NextArgument(index, argc, argv), options.border);
    } else if (argument == L"--sidebar") {
      ParseColor(NextArgument(index, argc, argv), options.sidebar);
    } else if (argument == L"--sidebar-text") {
      ParseColor(NextArgument(index, argc, argv), options.sidebarText);
    } else if (argument == L"--sidebar-text-muted") {
      ParseColor(NextArgument(index, argc, argv), options.sidebarTextMuted);
    } else if (argument == L"--text") {
      ParseColor(NextArgument(index, argc, argv), options.text);
    } else if (argument == L"--text-secondary") {
      ParseColor(NextArgument(index, argc, argv), options.textSecondary);
    } else if (argument == L"--text-muted") {
      ParseColor(NextArgument(index, argc, argv), options.textMuted);
    } else if (argument == L"--surface") {
      ParseColor(NextArgument(index, argc, argv), options.surface);
    } else if (argument == L"--raised") {
      ParseColor(NextArgument(index, argc, argv), options.raised);
    } else if (argument == L"--canvas") {
      ParseColor(NextArgument(index, argc, argv), options.canvas);
    } else if (argument == L"--strength") {
      options.strength = ParseUnitFloat(NextArgument(index, argc, argv), 0.35f);
    } else if (argument == L"--surface-alpha") {
      options.surfaceAlpha = ParseUnitFloat(NextArgument(index, argc, argv), 1.0f);
      if (options.surfaceAlpha < 0.35f) {
        throw std::runtime_error("surface alpha out of range");
      }
    } else if (argument == L"--sidebar-alpha") {
      options.sidebarAlpha = ParseUnitFloat(NextArgument(index, argc, argv), 1.0f);
      if (options.sidebarAlpha < 0.62f) {
        throw std::runtime_error("sidebar alpha out of range");
      }
    } else if (argument == L"--background-art") {
      options.backgroundPath.assign(NextArgument(index, argc, argv));
      if (!ValidArtworkPath(options.backgroundPath)) {
        throw std::runtime_error("background artwork invalid");
      }
    } else if (argument == L"--background-opacity") {
      options.backgroundOpacity = ParseUnitFloat(NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--background-position") {
      options.backgroundPosition = ParseBoundedUnsigned(
          NextArgument(index, argc, argv), 4, "background position invalid");
    } else if (argument == L"--feature-art") {
      options.featurePath.assign(NextArgument(index, argc, argv));
      if (!ValidArtworkPath(options.featurePath)) {
        throw std::runtime_error("feature artwork invalid");
      }
    } else if (argument == L"--feature-opacity") {
      options.featureOpacity = ParseUnitFloat(NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--feature-position") {
      options.featurePosition = ParseBoundedUnsigned(
          NextArgument(index, argc, argv), 4, "feature position invalid");
    } else if (argument == L"--feature-role") {
      options.featureRole = ParseBoundedUnsigned(
          NextArgument(index, argc, argv), 2, "feature role invalid");
    } else if (argument == L"--feature-mask") {
      options.featureMask = ParseBoundedUnsigned(
          NextArgument(index, argc, argv), 1, "feature mask invalid");
    } else if (argument == L"--sidebar-ratio") {
      options.sidebarRatio = ParseUnitFloat(NextArgument(index, argc, argv), 0.46f);
      if (options.sidebarRatio < 0.10f) throw std::runtime_error("sidebar ratio invalid");
    } else if (argument == L"--title-ratio") {
      options.titleRatio = ParseUnitFloat(NextArgument(index, argc, argv), 0.20f);
      if (options.titleRatio < 0.02f) throw std::runtime_error("title ratio invalid");
    } else if (argument == L"--feature-max-width") {
      options.featureMaximumWidthRatio = ParseUnitFloat(
          NextArgument(index, argc, argv), 0.98f);
      if (options.featureMaximumWidthRatio < 0.18f) {
        throw std::runtime_error("feature width invalid");
      }
    } else if (argument == L"--feature-max-height") {
      options.featureMaximumHeightRatio = ParseUnitFloat(
          NextArgument(index, argc, argv), 1.0f);
      if (options.featureMaximumHeightRatio < 0.18f) {
        throw std::runtime_error("feature height invalid");
      }
    } else if (argument == L"--greeting-x") {
      options.greetingRect[0] = ParseUnitFloat(NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--greeting-y") {
      options.greetingRect[1] = ParseUnitFloat(NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--greeting-width") {
      options.greetingRect[2] = ParseUnitFloat(NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--greeting-height") {
      options.greetingRect[3] = ParseUnitFloat(NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--greeting-destination-x") {
      options.greetingDestinationRect[0] = ParseUnitFloat(
          NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--greeting-destination-y") {
      options.greetingDestinationRect[1] = ParseUnitFloat(
          NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--greeting-destination-width") {
      options.greetingDestinationRect[2] = ParseUnitFloat(
          NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--greeting-destination-height") {
      options.greetingDestinationRect[3] = ParseUnitFloat(
          NextArgument(index, argc, argv), 1.0f);
    } else if (argument == L"--greeting-weight") {
      options.greetingWeight = ParseBoundedUnsigned(
          NextArgument(index, argc, argv), 900, "greeting weight invalid");
      if (options.greetingWeight < 100) {
        throw std::runtime_error("greeting weight invalid");
      }
    } else if (argument == L"--greeting-font") {
      options.greetingFont = ParseBoundedUnsigned(
          NextArgument(index, argc, argv), 3, "greeting font invalid");
    } else if (argument == L"--greeting-mark-scale") {
      options.greetingMarkScale = ParseUnitFloat(
          NextArgument(index, argc, argv), 1.25f);
      if (options.greetingMarkScale < 0.5f) {
        throw std::runtime_error("greeting mark scale invalid");
      }
    } else if (argument == L"--greeting") {
      options.greeting = true;
    } else if (argument == L"--greeting-accent") {
      options.greetingAccent = true;
    } else if (argument == L"--greeting-italic") {
      options.greetingItalic = true;
    } else if (argument == L"--greeting-compact-mark") {
      options.greetingCompactMark = true;
    } else if (argument == L"--landing") {
      options.landing = true;
    } else if (argument == L"--dark") {
      options.dark = true;
    } else if (argument == L"--source-dark") {
      options.sourceDark = true;
    } else if (argument == L"--stop-event") {
      const std::wstring_view value = NextArgument(index, argc, argv);
      if (!ValidOwnedEventName(value, L"Local\\ClaudeAuraDesktopGpu-")) {
        throw std::runtime_error("invalid stop event");
      }
      options.stopEventName.assign(value);
    } else if (argument == L"--ready-event") {
      const std::wstring_view value = NextArgument(index, argc, argv);
      if (!ValidOwnedEventName(value, L"Local\\ClaudeAuraDesktopGpuReady-")) {
        throw std::runtime_error("invalid ready event");
      }
      options.readyEventName.assign(value);
    } else {
      throw std::runtime_error("unknown argument");
    }
  }
  if (!options.target || !IsWindow(options.target)) {
    throw std::runtime_error("target window unavailable");
  }
  GetWindowThreadProcessId(options.target, &options.targetProcessId);
  if (!options.targetProcessId) {
    throw std::runtime_error("target process unavailable");
  }
  if (options.duration.count() == 0 && options.stopEventName.empty()) {
    throw std::runtime_error("unbounded run requires stop event");
  }
  if (options.greeting && (options.greetingRect[2] <= 0.0f
      || options.greetingRect[3] <= 0.0f
      || options.greetingRect[0] + options.greetingRect[2] > 1.001f
      || options.greetingRect[1] + options.greetingRect[3] > 1.001f)) {
    throw std::runtime_error("greeting rectangle invalid");
  }
  if (options.greeting && (options.greetingDestinationRect[2] <= 0.0f
      || options.greetingDestinationRect[3] <= 0.0f
      || options.greetingDestinationRect[0]
          + options.greetingDestinationRect[2] > 1.001f
      || options.greetingDestinationRect[1]
          + options.greetingDestinationRect[3] > 1.001f)) {
    throw std::runtime_error("greeting destination rectangle invalid");
  }
  return options;
}

RECT VisibleWindowRect(HWND window) {
  RECT rect{};
  if (FAILED(DwmGetWindowAttribute(window, DWMWA_EXTENDED_FRAME_BOUNDS,
                                   &rect, sizeof(rect))) ||
      rect.right <= rect.left || rect.bottom <= rect.top) {
    if (!GetWindowRect(window, &rect) || rect.right <= rect.left || rect.bottom <= rect.top) {
      throw std::runtime_error("target bounds unavailable");
    }
  }
  return rect;
}

bool TargetIdentityIntact() {
  if (!IsWindow(g_options.target)) return false;
  DWORD processId{};
  GetWindowThreadProcessId(g_options.target, &processId);
  return processId != 0 && processId == g_options.targetProcessId;
}

bool TargetIsForeground() {
  if (!TargetIdentityIntact() || IsIconic(g_options.target)) return false;
  const HWND foreground = GetForegroundWindow();
  return foreground && (foreground == g_options.target
      || GetAncestor(foreground, GA_ROOTOWNER) == g_options.target);
}

void PlaceOverlay() {
  if (!g_overlay || !TargetIdentityIntact()) return;
  if (!TargetIsForeground()) {
    ShowWindow(g_overlay, SW_HIDE);
    return;
  }
  const RECT rect = VisibleWindowRect(g_options.target);
  SetWindowPos(g_overlay, nullptr, rect.left, rect.top,
               rect.right - rect.left, rect.bottom - rect.top,
               SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW);
}

LRESULT CALLBACK WindowProcedure(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  switch (message) {
    case WM_NCHITTEST:
      return HTTRANSPARENT;
    case WM_MOUSEACTIVATE:
      return MA_NOACTIVATE;
    case WM_TIMER:
      if (!TargetIdentityIntact()) {
        g_evidence.targetClosed = true;
        g_running = false;
        PostQuitMessage(0);
      } else {
        PlaceOverlay();
      }
      return 0;
    case WM_CLOSE:
      ShowWindow(window, SW_HIDE);
      DestroyWindow(window);
      return 0;
    case WM_DESTROY:
      g_running = false;
      PostQuitMessage(0);
      return 0;
    default:
      return DefWindowProcW(window, message, wparam, lparam);
  }
}

bool OverlayPassesInput(HWND window) {
  SetLastError(ERROR_SUCCESS);
  const LONG_PTR extendedStyle = GetWindowLongPtrW(window, GWL_EXSTYLE);
  if (!extendedStyle && GetLastError() != ERROR_SUCCESS) return false;
  constexpr LONG_PTR required = WS_EX_LAYERED | WS_EX_TRANSPARENT
      | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;
  return (extendedStyle & required) == required;
}

HWND CreateOverlayWindow(HINSTANCE instance) {
  WNDCLASSEXW windowClass{sizeof(windowClass)};
  windowClass.lpfnWndProc = WindowProcedure;
  windowClass.hInstance = instance;
  windowClass.lpszClassName = kWindowClass;
  windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  if (!RegisterClassExW(&windowClass) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
    throw std::runtime_error("overlay class registration failed");
  }
  const RECT rect = VisibleWindowRect(g_options.target);
  HWND window = CreateWindowExW(
      WS_EX_LAYERED | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW
          | WS_EX_TRANSPARENT | WS_EX_TOPMOST,
      kWindowClass, L"Claude Aura Desktop GPU presentation", WS_POPUP,
      rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top,
      nullptr, nullptr, instance, nullptr);
  if (!window) throw std::runtime_error("overlay window creation failed");
  g_evidence.inputTransparent = OverlayPassesInput(window);
  if (!g_evidence.inputTransparent) {
    DestroyWindow(window);
    throw std::runtime_error("overlay input transparency unavailable");
  }
  SetTimer(window, kTrackTimer, 50, nullptr);
  return window;
}

ComPtr<ID3DBlob> CompileShader(const char* source, const char* entry, const char* target) {
  ComPtr<ID3DBlob> shader;
  ComPtr<ID3DBlob> errors;
  const HRESULT result = D3DCompile(source, std::strlen(source), nullptr, nullptr, nullptr,
                                    entry, target, D3DCOMPILE_OPTIMIZATION_LEVEL3, 0,
                                    &shader, &errors);
  if (FAILED(result)) {
    throw std::runtime_error("shader compilation failed");
  }
  return shader;
}

class CaptureRenderer {
 public:
  explicit CaptureRenderer(HWND output) : output_(output) {
    UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
    D3D_FEATURE_LEVEL requested[] = {
        D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0,
        D3D_FEATURE_LEVEL_10_1, D3D_FEATURE_LEVEL_10_0};
    D3D_FEATURE_LEVEL acquired{};
    check_hresult(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags,
                                    requested, ARRAYSIZE(requested), D3D11_SDK_VERSION,
                                    &device_, &acquired, &context_));

    ComPtr<IDXGIDevice> dxgiDevice;
    check_hresult(device_.As(&dxgiDevice));
    com_ptr<IInspectable> inspectable;
    check_hresult(CreateDirect3D11DeviceFromDXGIDevice(dxgiDevice.Get(), inspectable.put()));
    winrtDevice_ = inspectable.as<IDirect3DDevice>();

    auto factory = get_activation_factory<GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
    check_hresult(factory->CreateForWindow(g_options.target, guid_of<IGraphicsCaptureItem>(),
                                           put_abi(item_)));
    g_evidence.exactHwndIsolation = true;
    size_ = item_.Size();
    if (size_.Width <= 0 || size_.Height <= 0) {
      throw std::runtime_error("capture item has invalid size");
    }
    CreateSwapChain();
    backgroundView_ = LoadArtworkTexture(
        g_options.backgroundPath, backgroundAspect_, g_evidence.backgroundArtworkLoaded);
    featureView_ = LoadArtworkTexture(
        g_options.featurePath, featureAspect_, g_evidence.featureArtworkLoaded);
    g_evidence.artworkCompositing = backgroundView_ || featureView_;
    CreatePipeline();
    CreateCapture();
  }

  ~CaptureRenderer() {
    try {
      if (framePool_ && frameToken_.value) framePool_.FrameArrived(frameToken_);
      if (session_) session_.Close();
      if (framePool_) framePool_.Close();
      std::lock_guard<std::mutex> lock(renderMutex_);
      if (context_) {
        context_->ClearState();
        context_->Flush();
      }
      g_evidence.cleanupComplete = true;
    } catch (...) {
      g_evidence.cleanupComplete = false;
    }
  }

  void Start() {
    session_.StartCapture();
  }

 private:
  ComPtr<ID3D11ShaderResourceView> LoadArtworkTexture(
      const std::wstring& path, float& aspect, bool& loaded) {
    loaded = false;
    aspect = 1.0f;
    if (path.empty()) return {};
    ComPtr<IWICImagingFactory> factory;
    check_hresult(CoCreateInstance(
        CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
        IID_PPV_ARGS(&factory)));
    ComPtr<IWICBitmapDecoder> decoder;
    check_hresult(factory->CreateDecoderFromFilename(
        path.c_str(), nullptr, GENERIC_READ, WICDecodeMetadataCacheOnLoad, &decoder));
    UINT frameCount{};
    check_hresult(decoder->GetFrameCount(&frameCount));
    if (frameCount != 1) throw std::runtime_error("artwork frame count invalid");
    ComPtr<IWICBitmapFrameDecode> frame;
    check_hresult(decoder->GetFrame(0, &frame));
    UINT width{};
    UINT height{};
    check_hresult(frame->GetSize(&width, &height));
    if (!width || !height || width > 4096 || height > 4096) {
      throw std::runtime_error("artwork dimensions invalid");
    }
    const uint64_t stride64 = static_cast<uint64_t>(width) * 4;
    const uint64_t bytes64 = stride64 * height;
    if (bytes64 > 64ull * 1024ull * 1024ull) {
      throw std::runtime_error("artwork decode budget exceeded");
    }
    ComPtr<IWICFormatConverter> converter;
    check_hresult(factory->CreateFormatConverter(&converter));
    check_hresult(converter->Initialize(
        frame.Get(), GUID_WICPixelFormat32bppBGRA,
        WICBitmapDitherTypeNone, nullptr, 0.0, WICBitmapPaletteTypeCustom));
    std::vector<uint8_t> pixels(static_cast<size_t>(bytes64));
    check_hresult(converter->CopyPixels(
        nullptr, static_cast<UINT>(stride64), static_cast<UINT>(bytes64), pixels.data()));

    D3D11_TEXTURE2D_DESC description{};
    description.Width = width;
    description.Height = height;
    description.MipLevels = 1;
    description.ArraySize = 1;
    description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    description.SampleDesc.Count = 1;
    description.Usage = D3D11_USAGE_IMMUTABLE;
    description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    D3D11_SUBRESOURCE_DATA data{pixels.data(), static_cast<UINT>(stride64), 0};
    ComPtr<ID3D11Texture2D> texture;
    check_hresult(device_->CreateTexture2D(&description, &data, &texture));
    ComPtr<ID3D11ShaderResourceView> view;
    check_hresult(device_->CreateShaderResourceView(texture.Get(), nullptr, &view));
    aspect = static_cast<float>(width) / static_cast<float>(height);
    loaded = true;
    return view;
  }

  void CreateSwapChain() {
    ComPtr<IDXGIDevice> dxgiDevice;
    check_hresult(device_.As(&dxgiDevice));
    ComPtr<IDXGIAdapter> adapter;
    check_hresult(dxgiDevice->GetAdapter(&adapter));
    ComPtr<IDXGIFactory2> factory;
    check_hresult(adapter->GetParent(IID_PPV_ARGS(&factory)));
    DXGI_SWAP_CHAIN_DESC1 description{};
    description.Width = static_cast<UINT>((std::max)(1, size_.Width));
    description.Height = static_cast<UINT>((std::max)(1, size_.Height));
    description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    description.SampleDesc.Count = 1;
    description.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    description.BufferCount = 2;
    description.Scaling = DXGI_SCALING_NONE;
    description.SwapEffect = DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL;
    description.AlphaMode = DXGI_ALPHA_MODE_IGNORE;
    check_hresult(factory->CreateSwapChainForHwnd(device_.Get(), output_, &description,
                                                  nullptr, nullptr, &swapChain_));
    CreateRenderTarget();
  }

  void CreateRenderTarget() {
    ComPtr<ID3D11Texture2D> backBuffer;
    check_hresult(swapChain_->GetBuffer(0, IID_PPV_ARGS(&backBuffer)));
    check_hresult(device_->CreateRenderTargetView(backBuffer.Get(), nullptr, &renderTarget_));
  }

  void ResizeSwapChain(SizeInt32 nextSize) {
    DXGI_SWAP_CHAIN_DESC1 description{};
    check_hresult(swapChain_->GetDesc1(&description));
    const UINT width = static_cast<UINT>((std::max)(1, nextSize.Width));
    const UINT height = static_cast<UINT>((std::max)(1, nextSize.Height));
    if (description.Width == width && description.Height == height) return;
    context_->OMSetRenderTargets(0, nullptr, nullptr);
    renderTarget_.Reset();
    check_hresult(swapChain_->ResizeBuffers(
        0, width, height, DXGI_FORMAT_UNKNOWN, 0));
    CreateRenderTarget();
  }

  void CreatePipeline() {
    static constexpr char vertexSource[] = R"(
      struct VOut { float4 position : SV_POSITION; float2 uv : TEXCOORD0; };
      VOut main(uint id : SV_VertexID) {
        VOut output;
        float2 uv = float2((id << 1) & 2, id & 2);
        output.uv = uv;
        output.position = float4(uv * float2(2.0, -2.0) + float2(-1.0, 1.0), 0.0, 1.0);
        return output;
      })";
    static constexpr char pixelSource[] = R"(
      Texture2D sourceTexture : register(t0);
      Texture2D backgroundTexture : register(t1);
      Texture2D featureTexture : register(t2);
      SamplerState sourceSampler : register(s0);
      cbuffer Theme : register(b0) {
        float4 accent;
        float4 focus;
        float4 accentText;
        float4 border;
        float4 sidebar;
        float4 sidebarText;
        float4 sidebarTextMuted;
        float4 text;
        float4 textSecondary;
        float4 textMuted;
        float4 surface;
        float4 raised;
        float4 canvas;
        float strength;
        float darkMode;
        float surfaceAlpha;
        float sidebarAlpha;
        float sourceDarkMode;
        float3 padding;
        float backgroundOpacity;
        float featureOpacity;
        float backgroundPosition;
        float featurePosition;
        float featureRole;
        float featureMask;
        float landing;
        float sidebarRatio;
        float titleRatio;
        float backgroundAvailable;
        float featureAvailable;
        float featureMaximumWidthRatio;
        float featureMaximumHeightRatio;
        float3 featurePadding;
        float4 greetingRect;
        float4 greetingDestinationRect;
        float greetingActive;
        float greetingColorRole;
        float greetingWeight;
        float greetingItalic;
        float greetingFont;
        float greetingMarkSource;
        float greetingMarkScale;
        float greetingPadding;
      };
      struct VOut { float4 position : SV_POSITION; float2 uv : TEXCOORD0; };
      float luminance(float3 color) {
        return dot(color, float3(0.2126, 0.7152, 0.0722));
      }
      float median3(float first, float second, float third) {
        return max(min(first, second), min(max(first, second), third));
      }
      float3 median3Color(float3 first, float3 second, float3 third) {
        return float3(
          median3(first.r, second.r, third.r),
          median3(first.g, second.g, third.g),
          median3(first.b, second.b, third.b));
      }
      float3 coverageSafeAffineMap(float3 sourceColor,
          float3 sourceBackground, float3 sourceForeground,
          float3 targetBackground, float3 targetForeground) {
        float3 sourceSpan = sourceForeground - sourceBackground;
        float3 sourceDirection = step(0.0, sourceSpan) * 2.0 - 1.0;
        float3 safeSourceSpan = sourceDirection
          * max(abs(sourceSpan), float3(0.12, 0.12, 0.12));
        float3 sourceCoverage = (sourceColor - sourceBackground)
          / safeSourceSpan;
        return targetBackground
          + sourceCoverage * (targetForeground - targetBackground);
      }
      float4 sampleSourcePixel(float2 uv) {
        uint width;
        uint height;
        sourceTexture.GetDimensions(width, height);
        uint2 maximumPixel = uint2(max(1u, width) - 1u, max(1u, height) - 1u);
        uint2 pixel = min(uint2(saturate(uv) * float2(width, height)), maximumPixel);
        return sourceTexture.Load(int3(pixel, 0));
      }
      float4 main(VOut input) : SV_TARGET {
        float4 source = sampleSourcePixel(input.uv);
        uint width;
        uint height;
        sourceTexture.GetDimensions(width, height);
        float2 texel = 1.0 / max(float2(width, height), float2(1.0, 1.0));
        float3 topChromeFirst = sampleSourcePixel(
          float2(0.46, 0.025)).rgb;
        float3 topChromeSecond = sampleSourcePixel(
          float2(0.62, 0.025)).rgb;
        float3 topChromeThird = sampleSourcePixel(
          float2(0.78, 0.025)).rgb;
        float3 mainSourceBackground = median3Color(
          topChromeFirst, topChromeSecond, topChromeThird);
        float topChromeLuminance = luminance(mainSourceBackground);
        float sampledSourceDark = 1.0 - smoothstep(
          0.42, 0.62, topChromeLuminance);
        float sourceSampleConfidence = smoothstep(
          0.08, 0.22, abs(topChromeLuminance - 0.5));
        float capturedSourceDark = lerp(
          sourceDarkMode, sampledSourceDark, sourceSampleConfidence);
        float3 sidebarSourceBackground = median3Color(
          sampleSourcePixel(float2(0.07, 0.18)).rgb,
          sampleSourcePixel(float2(0.07, 0.38)).rgb,
          sampleSourcePixel(float2(0.07, 0.58)).rgb);
        float sourceMaximum = max(source.r, max(source.g, source.b));
        float sourceMinimum = min(source.r, min(source.g, source.b));
        float sourceChroma = sourceMaximum - sourceMinimum;
        float sourceLuminance = luminance(source.rgb);
        float3 leftColor = sampleSourcePixel(
          input.uv - float2(texel.x, 0.0)).rgb;
        float3 rightColor = sampleSourcePixel(
          input.uv + float2(texel.x, 0.0)).rgb;
        float3 upColor = sampleSourcePixel(
          input.uv - float2(0.0, texel.y)).rgb;
        float3 downColor = sampleSourcePixel(
          input.uv + float2(0.0, texel.y)).rgb;
        float leftLuminance = luminance(leftColor);
        float rightLuminance = luminance(rightColor);
        float upLuminance = luminance(upColor);
        float downLuminance = luminance(downColor);
        float3 neighborColor = (leftColor + rightColor + upColor + downColor) * 0.25;
        float edge = max(max(abs(sourceLuminance - leftLuminance),
                             abs(sourceLuminance - rightLuminance)),
                         max(abs(sourceLuminance - upLuminance),
                             abs(sourceLuminance - downLuminance)));
        float colorEdge = length(source.rgb - neighborColor) * 0.44;
        float detailSignal = max(edge, colorEdge);
        float sourceNeutral = 1.0 - smoothstep(0.035, 0.22, sourceChroma);
        float detail = smoothstep(0.016, 0.12, detailSignal);
        float lightSurfaceTier = smoothstep(0.80, 0.975, sourceLuminance);
        float darkSurfaceTier = smoothstep(0.055, 0.22, sourceLuminance)
          * (1.0 - smoothstep(0.42, 0.68, sourceLuminance));
        float surfaceTier = lerp(lightSurfaceTier, darkSurfaceTier, capturedSourceDark);
        float lightRaisedTier = smoothstep(0.982, 0.999, sourceLuminance);
        float darkRaisedTier = smoothstep(0.18, 0.36, sourceLuminance)
          * (1.0 - smoothstep(0.42, 0.66, sourceLuminance));
        float raisedTier = lerp(lightRaisedTier, darkRaisedTier, capturedSourceDark);
        float sidebarRegion = 1.0 - smoothstep(
          max(0.0, sidebarRatio - 0.012),
          min(1.0, sidebarRatio + 0.006), input.uv.x);
        float3 panelSurface = lerp(canvas.rgb, surface.rgb, surfaceAlpha);
        float3 raisedSurface = lerp(panelSurface, raised.rgb,
          saturate(surfaceAlpha + 0.14));
        float3 sidebarSurface = lerp(canvas.rgb, sidebar.rgb, sidebarAlpha);
        float3 mappedSurface = lerp(canvas.rgb, panelSurface, surfaceTier);
        mappedSurface = lerp(mappedSurface, raisedSurface, raisedTier);
        mappedSurface = lerp(mappedSurface, sidebarSurface, sidebarRegion);

        float3 bodyText = text.rgb * 0.82
          + textSecondary.rgb * 0.15 + textMuted.rgb * 0.03;
        float3 navigationText = sidebarText.rgb * 0.84
          + sidebarTextMuted.rgb * 0.16;
        float sourceForegroundValue = lerp(0.08, 0.94, capturedSourceDark);
        float3 sourceForeground = float3(
          sourceForegroundValue, sourceForegroundValue, sourceForegroundValue);
        float3 targetBackground = lerp(
          panelSurface, sidebarSurface, sidebarRegion);
        float3 targetForeground = lerp(
          bodyText, navigationText, sidebarRegion);
        float3 mainAffine = coverageSafeAffineMap(source.rgb,
          mainSourceBackground, sourceForeground, panelSurface, bodyText);
        float3 sidebarAffine = coverageSafeAffineMap(source.rgb,
          sidebarSourceBackground, sourceForeground,
          sidebarSurface, navigationText);
        float3 color = lerp(mainAffine, sidebarAffine, sidebarRegion);

        float2 mainOrigin = float2(sidebarRatio, titleRatio);
        float2 mainSpan = max(float2(0.001, 0.001), 1.0 - mainOrigin);
        float2 mainUv = (input.uv - mainOrigin) / mainSpan;
        float insideMain = step(0.0, mainUv.x) * step(mainUv.x, 1.0)
          * step(0.0, mainUv.y) * step(mainUv.y, 1.0);
        float regionAspect = (width * mainSpan.x) / max(1.0, height * mainSpan.y);
        float3 artworkScene = canvas.rgb;
        float artworkAvailable = 0.0;

        if (backgroundAvailable > 0.5 && insideMain > 0.0) {
          uint backgroundWidth;
          uint backgroundHeight;
          backgroundTexture.GetDimensions(backgroundWidth, backgroundHeight);
          float imageAspect = backgroundWidth
            / max(1.0, (float)backgroundHeight);
          float2 sourceSpan = float2(1.0, 1.0);
          if (imageAspect > regionAspect) sourceSpan.x = regionAspect / imageAspect;
          else sourceSpan.y = imageAspect / regionAspect;
          float2 sourceOffset = (1.0 - sourceSpan) * 0.5;
          if (backgroundPosition >= 0.5 && backgroundPosition <= 3.5) {
            sourceOffset.x = 1.0 - sourceSpan.x;
          } else if (backgroundPosition >= 3.5) {
            sourceOffset.x = 0.0;
          }
          if (backgroundPosition >= 2.5 && backgroundPosition <= 3.5) {
            sourceOffset.y = 0.0;
          } else if ((backgroundPosition >= 1.5 && backgroundPosition <= 2.5)
              || backgroundPosition >= 3.5) {
            sourceOffset.y = 1.0 - sourceSpan.y;
          }
          float4 backgroundSample = backgroundTexture.Sample(
            sourceSampler, sourceOffset + saturate(mainUv) * sourceSpan);
          artworkScene = lerp(artworkScene, backgroundSample.rgb,
            saturate(backgroundSample.a * backgroundOpacity));
          artworkAvailable = 1.0;
        }

        if (featureAvailable > 0.5 && insideMain > 0.0) {
          uint featureWidth;
          uint featureHeight;
          featureTexture.GetDimensions(featureWidth, featureHeight);
          float imageAspect = featureWidth / max(1.0, (float)featureHeight);
          float2 box = float2(featureMaximumWidthRatio,
            featureMaximumHeightRatio);
          float boxAspect = (box.x * regionAspect) / max(0.001, box.y);
          float2 drawSize;
          if (imageAspect > boxAspect) {
            drawSize.x = box.x;
            drawSize.y = box.x * regionAspect / imageAspect;
          } else {
            drawSize.y = box.y;
            drawSize.x = box.y * imageAspect / regionAspect;
          }
          float2 featureOffset = (1.0 - drawSize) * 0.5;
          if (featurePosition >= 0.5 && featurePosition <= 3.5) {
            featureOffset.x = 1.0 - drawSize.x;
          } else if (featurePosition >= 3.5) {
            featureOffset.x = 0.0;
          }
          if (featurePosition >= 2.5 && featurePosition <= 3.5) {
            featureOffset.y = 0.0;
          } else if ((featurePosition >= 1.5 && featurePosition <= 2.5)
              || featurePosition >= 3.5) {
            featureOffset.y = 1.0 - drawSize.y;
          }
          float2 featureUv = (mainUv - featureOffset) / max(
            drawSize, float2(0.001, 0.001));
          float insideFeature = step(0.0, featureUv.x) * step(featureUv.x, 1.0)
            * step(0.0, featureUv.y) * step(featureUv.y, 1.0);
          if (insideFeature > 0.0) {
            float4 featureSample = featureTexture.Sample(
              sourceSampler, saturate(featureUv));
            float softEntry = featureMask > 0.5
              ? smoothstep(0.0, 0.14, featureUv.x) : 1.0;
            artworkScene = lerp(artworkScene, featureSample.rgb,
              saturate(featureSample.a * featureOpacity * softEntry));
            artworkAvailable = 1.0;
          }
        }

        float surfaceConfidence = sourceNeutral * max(surfaceTier, raisedTier)
          * (1.0 - smoothstep(0.012, 0.095, detailSignal));
        float3 underlaySurface = lerp(artworkScene, mappedSurface, surfaceAlpha);
        float underlayAmount = insideMain * artworkAvailable
          * saturate(surfaceConfidence);
        color = lerp(color, underlaySurface, underlayAmount);

        return float4(color, source.a);
      })";
    auto vertexBlob = CompileShader(vertexSource, "main", "vs_5_0");
    auto pixelBlob = CompileShader(pixelSource, "main", "ps_5_0");
    check_hresult(device_->CreateVertexShader(vertexBlob->GetBufferPointer(),
                                               vertexBlob->GetBufferSize(), nullptr,
                                               &vertexShader_));
    check_hresult(device_->CreatePixelShader(pixelBlob->GetBufferPointer(),
                                              pixelBlob->GetBufferSize(), nullptr,
                                              &pixelShader_));
    D3D11_SAMPLER_DESC sampler{};
    sampler.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
    sampler.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampler.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampler.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampler.MaxLOD = D3D11_FLOAT32_MAX;
    check_hresult(device_->CreateSamplerState(&sampler, &sampler_));

    D3D11_BUFFER_DESC constants{};
    constants.ByteWidth = sizeof(ShaderConstants);
    constants.Usage = D3D11_USAGE_DEFAULT;
    constants.BindFlags = D3D11_BIND_CONSTANT_BUFFER;
    ShaderConstants values{
      {g_options.accent[0], g_options.accent[1], g_options.accent[2], 1.0f},
      {g_options.focus[0], g_options.focus[1], g_options.focus[2], 1.0f},
      {g_options.accentText[0], g_options.accentText[1], g_options.accentText[2], 1.0f},
      {g_options.border[0], g_options.border[1], g_options.border[2], 1.0f},
      {g_options.sidebar[0], g_options.sidebar[1], g_options.sidebar[2], 1.0f},
      {g_options.sidebarText[0], g_options.sidebarText[1], g_options.sidebarText[2], 1.0f},
      {g_options.sidebarTextMuted[0], g_options.sidebarTextMuted[1],
       g_options.sidebarTextMuted[2], 1.0f},
      {g_options.text[0], g_options.text[1], g_options.text[2], 1.0f},
      {g_options.textSecondary[0], g_options.textSecondary[1],
       g_options.textSecondary[2], 1.0f},
      {g_options.textMuted[0], g_options.textMuted[1], g_options.textMuted[2], 1.0f},
      {g_options.surface[0], g_options.surface[1], g_options.surface[2], 1.0f},
      {g_options.raised[0], g_options.raised[1], g_options.raised[2], 1.0f},
      {g_options.canvas[0], g_options.canvas[1], g_options.canvas[2], 1.0f},
      g_options.strength, g_options.dark ? 1.0f : 0.0f,
      g_options.surfaceAlpha, g_options.sidebarAlpha,
      g_options.sourceDark ? 1.0f : 0.0f, {0, 0, 0},
      g_options.backgroundOpacity, g_options.featureOpacity,
      static_cast<float>(g_options.backgroundPosition),
      static_cast<float>(g_options.featurePosition),
      static_cast<float>(g_options.featureRole),
      static_cast<float>(g_options.featureMask),
      g_options.landing ? 1.0f : 0.0f, g_options.sidebarRatio,
      g_options.titleRatio, backgroundView_ ? 1.0f : 0.0f,
      featureView_ ? 1.0f : 0.0f, g_options.featureMaximumWidthRatio,
      g_options.featureMaximumHeightRatio, {0, 0, 0},
      {g_options.greetingRect[0], g_options.greetingRect[1],
       g_options.greetingRect[2], g_options.greetingRect[3]},
      {g_options.greetingDestinationRect[0],
       g_options.greetingDestinationRect[1],
       g_options.greetingDestinationRect[2],
       g_options.greetingDestinationRect[3]},
      g_options.greeting ? 1.0f : 0.0f,
      g_options.greetingAccent ? 1.0f : 0.0f,
      static_cast<float>(g_options.greetingWeight),
      g_options.greetingItalic ? 1.0f : 0.0f,
      static_cast<float>(g_options.greetingFont),
      g_options.greetingCompactMark ? 1.0f : 0.0f,
      g_options.greetingMarkScale, 0.0f};
    D3D11_SUBRESOURCE_DATA data{&values};
    check_hresult(device_->CreateBuffer(&constants, &data, &constants_));
  }

  void CreateCapture() {
    framePool_ = Direct3D11CaptureFramePool::CreateFreeThreaded(
        winrtDevice_, DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, size_);
    session_ = framePool_.CreateCaptureSession(item_);
    try {
      session_.IsCursorCaptureEnabled(false);
    } catch (...) {
    }
    g_evidence.borderlessRequested = true;
    try {
      session_.IsBorderRequired(false);
      g_evidence.borderlessApplied = !session_.IsBorderRequired();
    } catch (...) {
      g_evidence.borderlessApplied = false;
    }
    frameToken_ = framePool_.FrameArrived([this](auto const& sender, auto const&) {
      RenderFrame(sender);
    });
    g_evidence.surfacePaletteMapping = true;
    g_evidence.semanticPaletteMapping = true;
    g_evidence.surfaceAlphaMapping = true;
    g_evidence.sourceAppearanceSampling = true;
    g_evidence.darkNeutralRemap = g_options.dark;
    g_evidence.coverageSafeAffineMapping = true;
  }

  void RenderFrame(Direct3D11CaptureFramePool const& sender) noexcept {
    try {
      std::lock_guard<std::mutex> lock(renderMutex_);
      auto frame = sender.TryGetNextFrame();
      if (!frame || !g_running || !TargetIsForeground()) return;
      const auto contentSize = frame.ContentSize();
      if (contentSize.Width <= 0 || contentSize.Height <= 0) {
        ++g_evidence.droppedFrames;
        return;
      }
      const bool resized = contentSize.Width != size_.Width
          || contentSize.Height != size_.Height;
      g_evidence.captureWidth = static_cast<uint32_t>(contentSize.Width);
      g_evidence.captureHeight = static_cast<uint32_t>(contentSize.Height);
      if (resized) {
        size_ = contentSize;
        ResizeSwapChain(size_);
        framePool_.Recreate(winrtDevice_, DirectXPixelFormat::B8G8R8A8UIntNormalized,
                            2, size_);
        g_evidence.nativeResolutionPreserved = false;
        ++g_evidence.droppedFrames;
        return;
      }
      auto access = frame.Surface().as<
          ::Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();
      ComPtr<ID3D11Texture2D> texture;
      check_hresult(access->GetInterface(IID_PPV_ARGS(&texture)));
      D3D11_TEXTURE2D_DESC sourceDescription{};
      texture->GetDesc(&sourceDescription);
      DXGI_SWAP_CHAIN_DESC1 swapDescription{};
      check_hresult(swapChain_->GetDesc1(&swapDescription));
      RECT clientRect{};
      if (!GetClientRect(output_, &clientRect)) {
        throw std::runtime_error("output client size unavailable");
      }
      const UINT clientWidth = static_cast<UINT>((std::max)(0L,
          clientRect.right - clientRect.left));
      const UINT clientHeight = static_cast<UINT>((std::max)(0L,
          clientRect.bottom - clientRect.top));
      g_evidence.swapChainWidth = swapDescription.Width;
      g_evidence.swapChainHeight = swapDescription.Height;
      g_evidence.outputClientWidth = clientWidth;
      g_evidence.outputClientHeight = clientHeight;
      const bool nativeResolutionPreserved =
          sourceDescription.Width == static_cast<UINT>(contentSize.Width)
          && sourceDescription.Height == static_cast<UINT>(contentSize.Height)
          && swapDescription.Width == static_cast<UINT>(contentSize.Width)
          && swapDescription.Height == static_cast<UINT>(contentSize.Height)
          && clientWidth == static_cast<UINT>(contentSize.Width)
          && clientHeight == static_cast<UINT>(contentSize.Height);
      g_evidence.nativeResolutionPreserved = nativeResolutionPreserved;
      if (!nativeResolutionPreserved) {
        ++g_evidence.droppedFrames;
        return;
      }
      ComPtr<ID3D11ShaderResourceView> sourceView;
      check_hresult(device_->CreateShaderResourceView(texture.Get(), nullptr, &sourceView));

      D3D11_VIEWPORT viewport{0.0f, 0.0f,
                              static_cast<float>(swapDescription.Width),
                              static_cast<float>(swapDescription.Height), 0.0f, 1.0f};
      ID3D11RenderTargetView* target = renderTarget_.Get();
      ID3D11ShaderResourceView* sources[] = {
        sourceView.Get(), backgroundView_.Get(), featureView_.Get()
      };
      ID3D11SamplerState* sampler = sampler_.Get();
      ID3D11Buffer* constants = constants_.Get();
      context_->OMSetRenderTargets(1, &target, nullptr);
      context_->RSSetViewports(1, &viewport);
      context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
      context_->VSSetShader(vertexShader_.Get(), nullptr, 0);
      context_->PSSetShader(pixelShader_.Get(), nullptr, 0);
      context_->PSSetShaderResources(0, ARRAYSIZE(sources), sources);
      context_->PSSetSamplers(0, 1, &sampler);
      context_->PSSetConstantBuffers(0, 1, &constants);
      context_->Draw(3, 0);
      ID3D11ShaderResourceView* empty[] = {nullptr, nullptr, nullptr};
      context_->PSSetShaderResources(0, ARRAYSIZE(empty), empty);
      check_hresult(swapChain_->Present(1, 0));
      g_evidence.gpuPixelTransform = true;
      ++g_evidence.frames;
    } catch (...) {
      ++g_evidence.droppedFrames;
    }
  }

  HWND output_{};
  SizeInt32 size_{};
  ComPtr<ID3D11Device> device_;
  ComPtr<ID3D11DeviceContext> context_;
  ComPtr<IDXGISwapChain1> swapChain_;
  ComPtr<ID3D11RenderTargetView> renderTarget_;
  ComPtr<ID3D11VertexShader> vertexShader_;
  ComPtr<ID3D11PixelShader> pixelShader_;
  ComPtr<ID3D11SamplerState> sampler_;
  ComPtr<ID3D11Buffer> constants_;
  ComPtr<ID3D11ShaderResourceView> backgroundView_;
  ComPtr<ID3D11ShaderResourceView> featureView_;
  float backgroundAspect_{1.0f};
  float featureAspect_{1.0f};
  IDirect3DDevice winrtDevice_{nullptr};
  GraphicsCaptureItem item_{nullptr};
  Direct3D11CaptureFramePool framePool_{nullptr};
  GraphicsCaptureSession session_{nullptr};
  event_token frameToken_{};
  std::mutex renderMutex_;
};

void WriteEvidence(const char* status, const char* reason) {
  std::printf(
      "{\"schemaVersion\":6,\"status\":\"%s\",\"reasonCode\":\"%s\","
      "\"captureSupported\":%s,\"exactHwndIsolation\":%s,"
      "\"dpiAwarenessPerMonitorV2\":%s,\"nativeResolutionPreserved\":%s,"
      "\"captureWidth\":%u,\"captureHeight\":%u,"
      "\"swapChainWidth\":%u,\"swapChainHeight\":%u,"
      "\"outputClientWidth\":%u,\"outputClientHeight\":%u,"
      "\"gpuPixelTransform\":%s,\"pixelReadback\":false,"
      "\"cpuFrameAccess\":false,\"screenshotWritten\":false,"
      "\"surfacePaletteMapping\":%s,\"surfacePaletteSize\":13,"
      "\"semanticPaletteMapping\":%s,\"semanticPaletteSize\":13,"
      "\"surfaceAlphaMapping\":%s,\"sourceAppearanceSampling\":%s,"
      "\"darkNeutralRemap\":%s,\"sourceDarkHint\":%s,"
      "\"coverageSafeAffineMapping\":%s,\"nonlinearTextRemap\":false,"
      "\"artworkCompositing\":%s,\"backgroundArtworkLoaded\":%s,"
      "\"featureArtworkLoaded\":%s,"
      "\"inputTransparent\":%s,\"inputIntercepted\":%s,"
      "\"runsOnlyWhileTargetForeground\":true,"
      "\"borderlessRequested\":%s,\"borderlessApplied\":%s,"
      "\"framesPresented\":%llu,\"droppedFrames\":%llu,"
      "\"readySignaled\":%s,\"stopRequested\":%s,"
      "\"targetClosed\":%s,\"cleanupComplete\":%s}\n",
      status, reason, g_evidence.captureSupported ? "true" : "false",
      g_evidence.exactHwndIsolation ? "true" : "false",
      g_evidence.dpiAwarenessPerMonitorV2 ? "true" : "false",
      g_evidence.nativeResolutionPreserved ? "true" : "false",
      static_cast<unsigned>(g_evidence.captureWidth.load()),
      static_cast<unsigned>(g_evidence.captureHeight.load()),
      static_cast<unsigned>(g_evidence.swapChainWidth.load()),
      static_cast<unsigned>(g_evidence.swapChainHeight.load()),
      static_cast<unsigned>(g_evidence.outputClientWidth.load()),
      static_cast<unsigned>(g_evidence.outputClientHeight.load()),
      g_evidence.gpuPixelTransform.load() ? "true" : "false",
      g_evidence.surfacePaletteMapping ? "true" : "false",
      g_evidence.semanticPaletteMapping ? "true" : "false",
      g_evidence.surfaceAlphaMapping ? "true" : "false",
      g_evidence.sourceAppearanceSampling ? "true" : "false",
      g_evidence.darkNeutralRemap ? "true" : "false",
      g_options.sourceDark ? "true" : "false",
      g_evidence.coverageSafeAffineMapping ? "true" : "false",
      g_evidence.artworkCompositing ? "true" : "false",
      g_evidence.backgroundArtworkLoaded ? "true" : "false",
      g_evidence.featureArtworkLoaded ? "true" : "false",
      g_evidence.inputTransparent ? "true" : "false",
      g_evidence.inputTransparent ? "false" : "true",
      g_evidence.borderlessRequested ? "true" : "false",
      g_evidence.borderlessApplied ? "true" : "false",
      static_cast<unsigned long long>(g_evidence.frames.load()),
      static_cast<unsigned long long>(g_evidence.droppedFrames.load()),
      g_evidence.readySignaled ? "true" : "false",
      g_evidence.stopRequested ? "true" : "false",
      g_evidence.targetClosed ? "true" : "false",
      g_evidence.cleanupComplete ? "true" : "false");
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  const BOOL dpiAwarenessSet =
      SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  g_evidence.dpiAwarenessPerMonitorV2 = dpiAwarenessSet
      || AreDpiAwarenessContextsEqual(GetThreadDpiAwarenessContext(),
                                      DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  try {
    init_apartment(apartment_type::multi_threaded);
    g_options = ParseOptions(argc, argv);
    if (!g_options.stopEventName.empty()) {
      g_stopEvent = OpenEventW(SYNCHRONIZE, FALSE, g_options.stopEventName.c_str());
      if (!g_stopEvent) throw std::runtime_error("stop event unavailable");
    }
    if (!g_options.readyEventName.empty()) {
      g_readyEvent = OpenEventW(EVENT_MODIFY_STATE, FALSE,
                                g_options.readyEventName.c_str());
      if (!g_readyEvent) throw std::runtime_error("ready event unavailable");
    }
    g_evidence.captureSupported = GraphicsCaptureSession::IsSupported();
    if (!g_evidence.captureSupported) throw std::runtime_error("graphics capture unsupported");
    g_overlay = CreateOverlayWindow(GetModuleHandleW(nullptr));
    {
      CaptureRenderer renderer(g_overlay);
      renderer.Start();
      PlaceOverlay();
      if (g_readyEvent) {
        if (!SetEvent(g_readyEvent)) throw std::runtime_error("ready event signal failed");
        g_evidence.readySignaled = true;
      }
      const auto deadline = g_options.duration.count() == 0
          ? (std::chrono::steady_clock::time_point::max)()
          : std::chrono::steady_clock::now() + g_options.duration;
      MSG message{};
      while (g_running && std::chrono::steady_clock::now() < deadline) {
        if (g_stopEvent && WaitForSingleObject(g_stopEvent, 0) == WAIT_OBJECT_0) {
          g_evidence.stopRequested = true;
          g_running = false;
          break;
        }
        while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
          if (message.message == WM_QUIT) {
            g_running = false;
            break;
          }
          TranslateMessage(&message);
          DispatchMessageW(&message);
        }
        MsgWaitForMultipleObjectsEx(0, nullptr, 16, QS_ALLINPUT, MWMO_INPUTAVAILABLE);
      }
      g_running = false;
      ShowWindow(g_overlay, SW_HIDE);
    }
    if (g_overlay && IsWindow(g_overlay)) DestroyWindow(g_overlay);
    if (g_stopEvent) {
      CloseHandle(g_stopEvent);
      g_stopEvent = nullptr;
    }
    if (g_readyEvent) {
      CloseHandle(g_readyEvent);
      g_readyEvent = nullptr;
    }
    const bool complete = g_evidence.frames.load() > 0
        && g_evidence.gpuPixelTransform.load()
        && g_evidence.inputTransparent
        && g_evidence.dpiAwarenessPerMonitorV2.load()
        && g_evidence.nativeResolutionPreserved.load()
        && g_evidence.cleanupComplete;
    const bool stoppedBeforeFrame = g_evidence.stopRequested
        && g_evidence.frames.load() == 0 && g_evidence.inputTransparent
        && g_evidence.cleanupComplete;
    WriteEvidence(complete ? "ok" : stoppedBeforeFrame ? "stopped" : "failed",
                  complete ? "desktop-capture-filter-complete"
                           : stoppedBeforeFrame
                               ? "desktop-capture-filter-stopped-before-frame"
                               : "desktop-capture-filter-no-frame-or-cleanup-failed");
    return complete || stoppedBeforeFrame ? 0 : 2;
  } catch (const hresult_error&) {
    if (g_overlay && IsWindow(g_overlay)) DestroyWindow(g_overlay);
    if (g_stopEvent) CloseHandle(g_stopEvent);
    if (g_readyEvent) CloseHandle(g_readyEvent);
    WriteEvidence("failed", "desktop-capture-filter-winrt-failed");
    return 3;
  } catch (const std::exception&) {
    if (g_overlay && IsWindow(g_overlay)) DestroyWindow(g_overlay);
    if (g_stopEvent) CloseHandle(g_stopEvent);
    if (g_readyEvent) CloseHandle(g_readyEvent);
    WriteEvidence("failed", "desktop-capture-filter-invalid-or-unavailable");
    return 4;
  } catch (...) {
    if (g_overlay && IsWindow(g_overlay)) DestroyWindow(g_overlay);
    if (g_stopEvent) CloseHandle(g_stopEvent);
    if (g_readyEvent) CloseHandle(g_readyEvent);
    WriteEvidence("failed", "desktop-capture-filter-unknown-failure");
    return 5;
  }
}
