# Notices

Claude Aura is an independent, unofficial customization project. It is not
affiliated with, endorsed by, or sponsored by Anthropic. Claude and related
marks belong to their respective owners.

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
has no artwork asset. Runtime artwork is supplied as self-contained SVG or
derived WebP layers; it contains no remote resources or bundled font files and
remains separate from the functional Claude interface.

Files under `theme_demo_previews` are supplied art-direction references, not
runtime assets. The raw composites are ignored by Git and excluded from
installers, preview generation, and releases. Six text-free 640 x 360 crops are
distributed under `assets/theme-art/<id>/card-preview.webp` solely as decorative
Aura Studio selector media; Study Library's selector is derived from its
isolated runtime SVG. No full composite, baked interface control, or interface
text is shipped, and selector thumbnails are never injected into Claude as
backgrounds.

User-provided images remain the property and responsibility of the user.
Confirm image, trademark, likeness, and distribution rights before sharing a
theme publicly.
