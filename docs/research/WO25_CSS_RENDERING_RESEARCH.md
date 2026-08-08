# WO-25 CSS rendering research - 2026-08-09

Scope: standards and first-party Chromium/Microsoft documentation for the WO-25 filter, PNG-mask, reduced-motion, and forced-colors paths. Recommendations below are implementation inferences; they are not claims of installed Aura/WebView2 runtime proof.

## Bottom line

- Keep filter serialization in one fixed order. CSS applies each function to the previous function's output, so reordering the same values can change the image.
- Omit an all-neutral filter chain and use `filter: none`. Neutral functions leave pixels unchanged, but any computed filter value other than `none` still creates a stacking context and can create a containing block.
- A transparent PNG can be used as an alpha silhouette: paint the desired tint with `background-color`, then apply the PNG through `mask-image`. Use the standard properties plus `-webkit-mask-*` fallbacks if Aura must tolerate Chromium/WebView2 runtimes older than Chromium 120.
- Stop decorative motion under `prefers-reduced-motion: reduce`. Under `forced-colors: active`, hide purely decorative layers and preserve a text/native fallback for any identity mark that carries meaning.

## 1. Filter order and neutral values

The CSS Filter Effects specification says filter functions are applied in the order provided: the first function receives the source graphic and every subsequent function receives the previous function's output. It also says filter functions operate in sRGB. [`filter` property, CSS Filter Effects Module Level 1](https://www.w3.org/TR/filter-effects-1/#FilterProperty)

For WO-25's five controls, the no-visible-change values are:

| Function | Neutral value | Standards basis |
| --- | --- | --- |
| `hue-rotate()` | `0deg` | `0deg` leaves the input unchanged. |
| `saturate()` | `1` / `100%` | `100%` leaves the input unchanged. |
| `brightness()` | `1` / `100%` | `100%` leaves the input unchanged. |
| `contrast()` | `1` / `100%` | `100%` leaves the input unchanged. |
| `blur()` | `0px` | Its default and interpolation initial value are `0px`. |

These definitions are in the specification's [supported filter functions](https://www.w3.org/TR/filter-effects-1/#supported-filter-functions).

Implementation consequence: choose and freeze one product order, for example `hue-rotate(...) saturate(...) brightness(...) contrast(...) blur(...)`, and test the exact emitted order. The specification does not prescribe that particular sequence; consistency is the product contract.

An all-neutral function list is not fully equivalent to `none`. The specification says `none` applies no filter, while a computed value other than `none` creates a stacking context and can establish a containing block. Therefore a sparse document should omit neutral values, and the renderer should emit `filter: none` (or no declaration) when every control is neutral. [`filter` property](https://www.w3.org/TR/filter-effects-1/#FilterProperty)

## 2. Transparent PNG as a CSS mask in Chromium/WebView2

CSS Masking allows `mask-image` to reference a CSS image and lets it be positioned, sized, and repeated like a background image. With the initial `mask-mode: match-source`, an image reference uses its alpha values as mask values. The target's alpha is multiplied by those values; the PNG's RGB channels do not determine an alpha mask. [CSS Masking overview](https://www.w3.org/TR/css-masking-1/#masking), [`mask-mode`](https://www.w3.org/TR/css-masking-1/#the-mask-mode), [mask processing](https://www.w3.org/TR/css-masking-1/#mask-processing)

A suitable silhouette pattern is:

```css
.identity-mark {
  background-color: var(--identity-color);
  -webkit-mask-image: url("sidebar-identity.png");
  mask-image: url("sidebar-identity.png");
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}
```

The unprefixed declarations are the standards path. Chromium 120 unprefixed `mask`, `mask-image`, `mask-mode`, and related properties and aligned them with the specification; the earlier implementation exposed the `-webkit-mask-*` forms. [Chrome 120 beta: CSS masking](https://developer.chrome.com/blog/chrome-120-beta#css_masking)

WebView2 uses Microsoft Edge as its rendering engine. Evergreen normally follows current Chromium platform updates, while Fixed Version and administratively delayed Evergreen installations can be older. This makes paired standard/prefixed declarations a conservative compatibility measure, not proof that a particular installed runtime has been exercised. [Introduction to WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/), [WebView2 development best practices](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/developer-guide)

Failure behavior matters: an unavailable, empty, unsupported, or otherwise undisplayable mask image is treated as transparent black, so the masked element becomes invisible. A local identity PNG therefore must not be the only carrier of required text or state; retain a native/styled-label fallback. [`mask-image`](https://www.w3.org/TR/css-masking-1/#the-mask-image)

## 3. Decorative imagery under user accessibility preferences

`prefers-reduced-motion: reduce` means the user requested removal or replacement of non-essential motion that can cause vestibular discomfort or distraction. Static decorative artwork need not disappear solely because this query matches, but its animation, parallax, and animated transitions should stop. Do not blanket-reset a static `transform` if that transform is required for positioning. [`prefers-reduced-motion`, Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion)

`forced-colors: active` means the user agent is enforcing a user-chosen limited palette. The standards explicitly encourage visual simplification such as removing decorative backgrounds, gradients, and shadows. In forced-colors mode, non-URL `background-image` values compute to `none`, but URL-backed images can remain; relying on automatic adjustment alone does not guarantee that decorative PNG/WebP layers disappear. [`forced-colors`, Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/#forced-colors), [forced-color adjustments](https://www.w3.org/TR/css-color-adjust-1/#forced-colors-properties)

Recommended policy for Aura's inert artwork:

```css
@media (prefers-reduced-motion: reduce) {
  [data-aura-decorative] {
    animation: none !important;
    transition: none !important;
  }
}

@media (forced-colors: active) {
  [data-aura-decorative] {
    display: none !important;
  }
}
```

If an identity mark is functional rather than decorative, keep an adjacent native/text fallback that remains legible in the forced palette. Avoid `forced-color-adjust: none` merely to preserve theme colors: the specification says authors should use that opt-out only when they themselves provide an accessible forced-colors treatment. [`forced-color-adjust`](https://www.w3.org/TR/css-color-adjust-1/#propdef-forced-color-adjust)

## Verification boundary

This note establishes standards behavior and documented engine support. It does not replace a current installed-runtime check. WO-25 should still verify the exact emitted CSS and exercise the mask/filter/accessibility branches in the repository tests; a live visual claim still requires the project's actual-Aura capture gate.
