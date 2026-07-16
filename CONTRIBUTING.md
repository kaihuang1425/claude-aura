# Contributing

Keep changes reversible and scoped to WebView renderer memory. Do not patch
Claude Desktop files, bypass signatures, alter account/model/provider settings, hide
safety prompts, or add remote resources to themes.

Before opening a pull request:

```bash
npm test
npm run preview:build
npm run check
```

For visual changes, test Home, Code, Chat and Cowork controls, Settings,
dialogs, menus, light mode, dark mode, custom backgrounds, and **Original
look**. Include screenshots with private content removed. Report the Aura
version, WebView2 version, and
operating system.

Theme contributions must define both modes and pass the automated contrast
guardrails. Keep names lowercase kebab-case and avoid third-party artwork unless
its license and provenance are documented.
