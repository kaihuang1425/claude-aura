# Studio preview assets

This directory keeps theme-selection imagery separate from renderer artwork.
Nothing here is injected into `claude.ai`, and these files are product media,
not acceptance evidence.

## `masters/`

Preserved, uncropped source images for Aura Studio theme cards. Studio renders
the master through a saved `x`, `y`, and `zoom` frame; reframing never rewrites
the image. The filenames match frozen theme IDs. `study-library.png` is a
byte-for-byte copy of that source kit's supplied transparent book artwork; the
other six files are the original theme demo images, renamed without changing
their bytes.

| Previous filename | Categorized path |
| --- | --- |
| `c1cad58a-97a8-4dd1-8270-14a52658fa4f.png` | `masters/anime-twilight.png` |
| `Claude app interface with K-pop theme.png` | `masters/korean-idol.png` |
| `Claude's friendly productivity dashboard.png` | `masters/cartoon-studio.png` |
| `Elegant Japanese-inspired app interface.png` | `masters/japanese-film-editorial.png` |
| `Kawaii idol-themed app interface.png` | `masters/japanese-idol.png` |
| `Sleek dark mode app dashboard.png` | `masters/korean-prestige.png` |
| `Claude's ocean-themed assistant dashboard.png` | `references/cartoon-ocean-alternate.png` |

## `references/`

Unassigned or alternate art direction. These files are preserved for future
theme work but are not loaded by Aura Studio or the renderer. The current
`cartoon-ocean-alternate.png` file was previously named
`Claude's ocean-themed assistant dashboard.png`.

Full interface composites in this directory express visual direction only.
The live `claude.ai` document remains the sole source of interface structure
and text, and only whole-window captures of the actual Aura app count as visual
acceptance evidence.
