# Contributing

Keep changes reversible and scoped to WebView renderer memory. Do not patch
Claude Desktop files, bypass signatures, alter account/model/provider settings, hide
safety prompts, or add remote resources to themes.

Before opening a pull request:

```bash
npm test
npm run studio:build
npm run check
```

For visual changes, test Home, Code, Chat and Cowork controls, Settings,
dialogs, menus, light mode, dark mode, custom backgrounds, and **Original
look** in the actual Aura WebView2 window on live `claude.ai`. Include
whole-window screenshots with private content removed. `npm run verify:cycle`
is a non-image compile/validation pass for all eight themes in Light and Dark;
it creates no UI evidence. Do not generate fixture UI images, QA boards,
contact sheets, offline previews, or image goldens. Report the Aura version,
WebView2 version, and operating system.

Theme contributions must define both modes and pass the automated contrast
guardrails. Keep names lowercase kebab-case and avoid third-party artwork unless
its license and provenance are documented.
