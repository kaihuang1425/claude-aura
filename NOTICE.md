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
the seven isolated SVG files under `assets/theme-art` are original project work
distributed under the repository's MIT License. The Default theme intentionally
has no artwork asset. Bundled human forms are abstract fictional adults; they do
not depict or imply any real person, celebrity, performer, endorsement, or
official collaboration. The Cartoon Studio mascot and Anime Twilight
environment are also original project artwork. No third-party fonts, portrait
files, raster images, or external resources are embedded in these SVG files.

Files under `theme_demo_previews` are supplied art-direction references, not
runtime assets. Claude Aura does not use those composites as interface layers,
backgrounds, previews, or sources for tracing or vectorization. The preview
builder never reads them, and the release builder excludes the directory.

User-provided images remain the property and responsibility of the user.
Confirm image, trademark, likeness, and distribution rights before sharing a
theme publicly.
