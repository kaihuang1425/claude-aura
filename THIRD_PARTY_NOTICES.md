# Third-party notices

Claude Aura's original prototype adapted portions of the loopback session
validation from Codex Dream Skin Studio. Its semantic Claude theme mapping was
informed by claude-desktop-bin. Both projects are licensed under the MIT
License. The current Windows launcher uses WebView2 instead of a debugging
endpoint.

## Codex Dream Skin Studio

Copyright (c) 2026 Codex Dream Skin Studio contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Source: https://github.com/Fei-Away/Codex-Dream-Skin

## claude-desktop-bin

Copyright (c) 2026 Patrick Jaja

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Source: https://github.com/patrickjaja/claude-desktop-bin

## Microsoft Edge WebView2 SDK

Claude Aura includes the Microsoft.Web.WebView2 SDK assemblies and native
loader from NuGet package version 1.0.4078.44. Copyright (c) Microsoft
Corporation.

The complete license and notice supplied with the package are included at
`vendor/webview2/LICENSE.txt` and `vendor/webview2/NOTICE.txt`.

Source: https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4078.44

## Project theme artwork and reference derivatives

The isolated SVG and WebP renderer layers under `assets/theme-art` are Claude
Aura project assets licensed under the repository's MIT License. They contain
no bundled third-party fonts or remote resources and do not add a software
dependency or runtime service.

The project-supplied concept images under `assets/studio-previews/masters` are
distributed only as Aura Studio theme-selection media. The live renderer never
loads these files as Claude artwork or backgrounds, and Studio framing never
modifies their bytes. Alternate concepts under
`assets/studio-previews/references` are source-only and excluded from releases.
The older 640 x 360 WebP selector crops remain compatibility fallbacks.

Claude Aura 0.3 adds no npm package or runtime font dependency. Theme font
stacks use locally available system fallbacks. The WebView2 SDK listed above is
the only vendored runtime integration covered by this notice.
