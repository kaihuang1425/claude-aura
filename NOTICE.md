# Notices

Claude Aura is an independent, unofficial customization project. It is not
affiliated with, endorsed by, or sponsored by Anthropic. Claude and related
marks belong to their respective owners.

The repository's MIT License applies only to project-authored code and assets.
It grants no rights in Anthropic's names, marks, interface, website, or
applications. Anthropic's current trademark guidance requires prior approval
for its names and marks and does not permit altered marks. A disclaimer is not
permission; obtain any required written approval and legal review before a
public or commercial release that retains the Claude Aura name or theme-styled
Claude wordmarks.

The software never redistributes or modifies Claude Desktop, `app.asar`, the
application bundle, package signature, account data, conversation data, model
settings, API keys, or provider configuration. On Windows it loads the real
Claude web interface in Microsoft WebView2 and applies local CSS in memory.

The original loopback session-validation work was informed by
[Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin),
which is available under the MIT License. Claude semantic-token mapping was
informed by public theme documentation in
[patrickjaja/claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin).
Since version 0.2, Claude Aura has not used the loopback approach on Windows
because current Claude releases require Anthropic-signed debugging
authorization.

The eight built-in Claude Aura interface systems, their registry metadata, and
the isolated runtime artwork under `assets/theme-art` are project work
distributed under the repository's MIT License. The Default theme intentionally
has no decorative renderer artwork. Runtime artwork is supplied as
self-contained SVG or derived WebP layers; it contains no remote resources or
bundled font files and remains separate from the functional Claude interface.
Each built-in also has a distinct project-authored identity. Repository-only
1254×1254 transparent sources were created with the built-in image-generation
mode; their exact prompt record is retained beside them. Those sources
deterministically produce the distributable 96×96 PNG and nine-frame ICO under
`assets/theme-art/<id>/`.

Uncropped theme-selection masters under `assets/studio-previews/masters` are
distributed solely as Aura Studio picker media. Some are full-interface concept
composites and may contain baked sample controls or text; they are never
injected into Claude, used as renderer backgrounds, or accepted as product UI
evidence. Studio saves framing separately and never rewrites these masters.
Alternate art direction under `assets/studio-previews/references` remains
source-only and is excluded from installers and releases. This exclusion
includes the built-in launcher sources and prompt record; only their derived
runtime PNG/ICO files ship. Legacy 640 x 360 selector crops under
`assets/theme-art/<id>/card-preview.webp` remain compatibility fallbacks only.

The six user-supplied PNGs under `docs/readme-showcase` are repository
documentation references only. They communicate visual direction, are excluded
from release installers, and are never renderer artwork, importable
backgrounds, or product-acceptance evidence. They may contain third-party
interface imagery, names, marks, and human-like portrait artwork. Neither their
README captions nor the repository license grants permission to reuse those
elements.

User-provided images remain the property and responsibility of the user.
Confirm image, trademark, likeness, and distribution rights before sharing a
theme publicly.
