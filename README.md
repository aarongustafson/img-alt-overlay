# img-alt-overlay

[![npm version](https://img.shields.io/npm/v/@aarongustafson/img-alt-overlay.svg)](https://www.npmjs.com/package/@aarongustafson/img-alt-overlay)
[![CI status](https://img.shields.io/github/actions/workflow/status/aarongustafson/img-alt-overlay/ci.yml?branch=main&label=CI)](https://github.com/aarongustafson/img-alt-overlay/actions/workflows/ci.yml)
[![Minified + gzipped size](https://img.shields.io/bundlejs/size/@aarongustafson/img-alt-overlay?format=minzip&label=min%2Bgzip)](https://bundlejs.com/?q=@aarongustafson/img-alt-overlay)
[![License](https://img.shields.io/npm/l/@aarongustafson/img-alt-overlay)](https://github.com/aarongustafson/img-alt-overlay/blob/main/LICENSE)
[![Type definitions](https://img.shields.io/npm/types/@aarongustafson/img-alt-overlay)](https://github.com/aarongustafson/img-alt-overlay/blob/main/img-alt-overlay.d.ts)

`<img-alt-overlay>` wraps an image and adds a button that reveals its alternative
text in a non-modal dialog over the image. It leaves the image, its `alt` attribute, responsive
sources, and links alone. Without JavaScript, the original image still works.

The interaction builds on the alt-text overlay on
[Aaron’s website](https://www.aaron-gustafson.com/notebook/there-can-be-only-one-redux/).
Like that panel, it stays inside the image’s block and leaves the rest of the
page interactive. It has no backdrop and doesn’t trap keyboard focus. Activate
the opener again to close the panel; its label changes to the dismissal wording
while open.

## Try it

This package is in development and hasn’t been published. From a checkout:

```sh
npm ci
node scripts/serve.js
```

Open [the demo](http://127.0.0.1:4177/demo/). It covers default controls,
translation, right-to-left layout, linked responsive images, theming, decorative
images, and failed image loading.

## Load and register

Once published, import the registration entry point:

```js
import '@aarongustafson/img-alt-overlay/define.js';
```

Load the optional stylesheet using your bundler, or serve it as a normal stylesheet:

```css
@import '@aarongustafson/img-alt-overlay/img-alt-overlay.css';
```

For a local checkout, put these in the document head:

```html
<link rel="stylesheet" href="./img-alt-overlay/img-alt-overlay.css" />
<script type="module" src="./img-alt-overlay/define.js"></script>
```

The package root and class file are **class-only imports**; neither registers
an element:

```js
import { ImgAltOverlayElement } from '@aarongustafson/img-alt-overlay';

customElements.define('img-alt-overlay', ImgAltOverlayElement);
```

Importing `define.js` registers `img-alt-overlay` when a browser registry exists.
It also exports `defineImgAltOverlay()`, which returns `false` without a registry
and `true` when the name is already registered or registration succeeds. It
doesn’t overwrite an existing registration. Class and registration imports are
safe without a browser DOM; constructing the class requires one.

## Wrap an image

```html
<img-alt-overlay>
  <img
    src="bicycle.jpg"
    width="640"
    height="360"
    alt="A red bicycle beside a blue wall, with a basket on its handlebars."
  />
</img-alt-overlay>
```

Use exactly one image belonging to the wrapper. A `picture` element and an image
link are supported:

```html
<figure>
  <img-alt-overlay>
    <a href="bicycle-large.jpg">
      <picture>
        <source media="(min-width: 40em)" srcset="bicycle-wide.jpg" />
        <img
          src="bicycle.jpg"
          width="640"
          height="360"
          alt="View the red bicycle photograph."
        />
      </picture>
    </a>
  </img-alt-overlay>
  <figcaption>A neighborhood bicycle.</figcaption>
</figure>
```

Put links **inside** the wrapper, not around it. The generated button must not be
nested in a link, button, or label. Keep captions outside the wrapper so the
overlay is positioned over the image rather than the caption.

Empty, missing, or whitespace-only alt text produces no controls. Empty `alt=""`
is appropriate for decorative images; missing alt text isn’t a substitute for
writing an appropriate alternative. This component doesn’t generate descriptions,
infer them from filenames, or repair missing alt text.

## Native commands, with a small fallback

The component adds light-DOM markup equivalent to:

```html
<button
  data-alt-trigger
  type="button"
  commandfor="image-alt-dialog"
  command="--toggle-alt"
  aria-controls="image-alt-dialog"
  aria-haspopup="dialog"
  aria-expanded="false"
>
  View alt text
</button>
<div data-alt-ui>
  <dialog
    data-alt-dialog
    id="image-alt-dialog"
    aria-labelledby="image-alt-heading"
  >
    <h2 id="image-alt-heading">Image description</h2>
    <p tabindex="-1" autofocus>The image’s alternative text.</p>
    <button
      type="button"
      commandfor="image-alt-dialog"
      command="close"
      aria-label="Close"
    >
      <span aria-hidden="true">✕</span>
    </button>
  </dialog>
</div>
```

IDs are generated per instance. Supporting browsers handle the
[`command` and `commandfor` attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#command).
The opener uses the custom `--toggle-alt` command: its `command` event calls
`dialog.show()` when closed and `dialog.close()` when open. HTML has no built-in
command for toggling a non-modal dialog. The separate Close button uses the
built-in `close` command. The opener’s wording and `aria-expanded` stay in sync
when either control or Escape closes the panel.
Where the button’s `commandForElement` API is absent, a delegated click listener
calls the native dialog’s `show()` and `close()` methods instead. It respects
canceled clicks and never runs alongside the supported native command path.

Escape closes the dialog while focus is inside the wrapper, unless the key event
has already been canceled. The listener belongs to the wrapper, not the document;
Escape elsewhere on the page doesn’t dismiss an unrelated image’s description.

The fallback is for **commands**, not for dialog itself. If the native dialog
methods aren’t available, enhancement reports an error and adds no controls.
There’s no dialog polyfill, popover mode, image enlargement, or remote request.

## Labels and configuration

| Attribute      | Default             | Purpose                                                                                  |
| -------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `button-label` | `View alt text`     | Visible and accessible name of the opener                                                |
| `dialog-label` | `Image description` | Dialog heading and accessible name; visually hidden by the default stylesheet            |
| `close-label`  | `Close`             | Dismissal wording for the open-state opener and accessible name of the icon Close button |

Authored attributes override defaults. All labels must contain non-whitespace
text. Labels and alt text are inserted as plain text, never interpreted as HTML.
There are no separate ARIA-only labels that could diverge from visible wording.

```html
<img-alt-overlay
  lang="fr"
  button-label="Voir le texte alternatif"
  dialog-label="Description de l’image"
  close-label="Fermer"
>
  <img
    src="bicycle.jpg"
    alt="Un vélo rouge devant un mur bleu, avec un panier sur le guidon."
  />
</img-alt-overlay>
```

Supply translations for all three labels and the image alternative. `lang` and
`dir` inherit normally. Changing a label attribute schedules a refresh, closing
any open dialog and rebuilding the controls with the new wording.

## Updates, lifecycle, and errors

Setup runs in a queued microtask after connection. Normal module scripts in the
document head defer until parsing finishes; don’t hide the image while waiting
for definition or successful setup.

The component observes only the controlled image’s `alt` attribute. Text changes
update the existing dialog without closing it. Emptying or removing `alt` closes
and removes the controls; adding nonempty text creates them again.

Call `refresh()` after replacing an image or changing the authored structure:

```js
const wrapper = document.querySelector('img-alt-overlay');
wrapper.refresh();
```

`refresh()` closes any open dialog and rereads the image and labels. It doesn’t
change authored nodes. Disconnecting closes and removes generated UI and
disconnects the observer and fallback listener. Reconnecting initializes again.

The read-only `state` property is:

| Value      | Meaning                                      |
| ---------- | -------------------------------------------- |
| `idle`     | Not connected or not yet initialized         |
| `inactive` | Valid image, but no nonempty alt text        |
| `ready`    | Dialog controls are available                |
| `error`    | Enhancement failed; authored content remains |

| Event                   | When                                    | Detail      |
| ----------------------- | --------------------------------------- | ----------- |
| `img-alt-overlay:ready` | A new set of usable controls is created | None        |
| `img-alt-overlay:error` | Invalid configuration or setup failure  | `{ error }` |

Both events bubble. Listen before inserting the element or loading the
registration module if you need initial events:

```js
document.addEventListener('img-alt-overlay:error', (event) => {
  console.error('Alt-text enhancement failed:', event.detail.error);
});
```

Invalid image counts, wrappers inside interactive controls, empty labels, and
unsupported dialog APIs are errors. Fix the markup and call `refresh()` to retry.
An image load failure isn’t an enhancement failure: its authored alternative
text remains available in the dialog.

## Styling

All generated UI is light DOM. Without the optional stylesheet, controls remain
in normal flow and the browser supplies the dialog presentation. With it, the
opener sits at the image’s block-start/inline-end corner and the non-modal dialog
is vertically centered in the space below the opener within the image wrapper.
Its width and maximum height are bounded by that block, not the viewport.
The default overlay area reserves 3.75rem above the panel for the opener.
If you move the opener or use larger, multiline labels, adjust the overlay
insets to leave enough room. Long descriptions
wrap and scroll inside the panel; it moves with the image as the page scrolls
or resizes. The layout layer lets pointer clicks pass through to the image or
its link outside the controls and open panel.

The description stays centered across and along the panel, with no paragraph
margin or visible focus ring. It still receives initial focus so the browser can
present the dialog and its text. Long content starts at the top and scrolls
rather than being clipped above the panel.

The separate Close button is a ✕ with its accessible name taken from
`close-label`. It stays visually hidden until focused and remains in the keyboard
tab order and accessibility tree. When revealed, it sits at the dialog’s block
start/inline end, has a 44px minimum target at the default font size, and keeps
its visible focus ring. Its space is reserved, so revealing it doesn’t enlarge
the panel or cover the text. It remains visible during pointer interaction once
revealed. Without the stylesheet, the icon button stays visible in normal flow.

Use `--img-alt-dialog-min-block-size` to change the panel’s minimum height.
The default is `30%` of the available image-overlay area, rather than the whole
image; the opener’s reserved space is outside that area. The minimum is capped
at the available area so small images and long descriptions remain bounded.
The percentage-based cap requires an overlay area with a definite block size,
even when the custom property contains a length. For an auto-sized,
edge-anchored area, set the dialog’s `min-block-size` directly instead, as in
the example below.

The [website-style demo](./demo/index.html#site-style-example) shows a full-image-width,
borderless black panel with white text. It sets the overlay’s inline insets to
zero, keeps spacing around the opener, and themes only that instance through
an authored class.

Stable hooks:

- `[data-alt-ui]`: positioned area containing the panel, separate from the opener.
- `[data-alt-trigger]`: opener button.
- `[data-alt-dialog]`: native non-modal dialog; there is no backdrop.
- `[data-alt-text]`: alternative-text paragraph.
- `[data-alt-close]`: close button.

| CSS custom property               | Default      |
| --------------------------------- | ------------ |
| `--img-alt-button-color`          | `#fff`       |
| `--img-alt-button-background`     | `#111`       |
| `--img-alt-dialog-color`          | `CanvasText` |
| `--img-alt-dialog-background`     | `Canvas`     |
| `--img-alt-focus-color`           | `Highlight`  |
| `--img-alt-dialog-min-block-size` | `30%`        |

### Position the opener and overlay

These properties accept CSS inset values, such as lengths, percentages, and
`auto`. They position the opener and overlay area independently, relative to the
image wrapper. Logical sides follow the writing mode and direction:
`inline-start` is left in horizontal left-to-right text and right in
right-to-left text.

| CSS custom property                    | Default   |
| -------------------------------------- | --------- |
| `--img-alt-button-inset-block-start`   | `0.5rem`  |
| `--img-alt-button-inset-block-end`     | `auto`    |
| `--img-alt-button-inset-inline-start`  | `auto`    |
| `--img-alt-button-inset-inline-end`    | `0.5rem`  |
| `--img-alt-overlay-inset-block-start`  | `3.75rem` |
| `--img-alt-overlay-inset-block-end`    | `0.5rem`  |
| `--img-alt-overlay-inset-inline-start` | `0.5rem`  |
| `--img-alt-overlay-inset-inline-end`   | `0.5rem`  |

When both block insets have values, the dialog centers in the bounded area
between them. Set the opposite inset to `auto` to anchor the natural-height
area to one block edge instead. The same CSS positioning rules apply to the
opener: when moving it to another corner, clear its opposing insets.
The [repositioning demo](./demo/index.html#inset-example) moves the opener to
block end/inline start and leaves room for it below the overlay.

For a panel anchored to block end and both inline edges:

```css
img-alt-overlay.bottom-panel {
  --img-alt-overlay-inset-block-start: auto;
  --img-alt-overlay-inset-block-end: 0;
  --img-alt-overlay-inset-inline-start: 0;
  --img-alt-overlay-inset-inline-end: 0;
}

img-alt-overlay.bottom-panel [data-alt-ui] {
  max-block-size: calc(100% - 3.75rem);
}

img-alt-overlay.bottom-panel [data-alt-dialog] {
  min-block-size: 4rem;
}
```

The height limit leaves room for the default opener when text needs to scroll.
The minimum height fits the Close button and its focus ring even when the
description is short.
The [slide-in demo](./demo/index.html#slide-up-example) adds 300ms CSS transitions
to this layout, sliding and fading the panel in and out. It clips motion within
the image and skips transitions when the reader requests reduced motion.
[`@starting-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style)
defines the entry state, and a
[`display` transition with `allow-discrete`](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior)
keeps the closing panel rendered until the exit finishes. Browsers without
discrete-transition support open and close it immediately. Some engines parse
`allow-discrete` but can’t transition a native dialog’s `display`; those still
animate entry but close immediately. This non-modal dialog
doesn’t enter the top layer or use a backdrop, so it needs no `overlay` or
`::backdrop` transition. The component’s default stylesheet adds no motion.

Keep visible focus indicators, legible contrast, and a reachable Close control.
Don’t override the native dialog’s closed-state visibility. If you manually
register the class under another tag name, adapt the stylesheet’s
`img-alt-overlay` selectors to that tag.

## Accessibility behavior and limits

- The original image keeps its native alternative text. The dialog provides an
  optional visible copy; it doesn’t replace the image’s accessible name.
- The opener is a real `type="button"` with `aria-haspopup="dialog"` and a
  synchronized `aria-expanded` state. The dialog is named by its heading, which
  the default stylesheet visually hides to keep the panel compact.
- Opening focuses the alternative-text paragraph, which is programmatically
  focusable but not an extra Tab stop. This keeps a long description’s beginning
  visible rather than scrolling immediately to Close.
- The dialog is non-modal: the rest of the document stays interactive, and Tab
  can leave the panel. Close or Escape within the wrapper dismisses it; native
  dialog behavior restores prior keyboard focus when focus is still inside.
  Pointer focus follows browser conventions: Safari, for example, doesn’t always
  focus clicked buttons. The component doesn’t force a different pointer-focus
  policy.
- This is a named dialog with an interactive Close control, not `role="tooltip"`.
  It opens by explicit activation rather than hover alone.
- No extra live region announces the same description, and no animation is added.
- Images, links, sources, dimensions, and loading hints remain unchanged. Without
  JavaScript, or after setup failure, no dead controls are added.

An alt-text dialog isn’t a replacement for visible captions, nearby explanations,
or a proper long description. Authors remain responsible for the alternative’s
quality and context. Don’t include sensitive information in alt text expecting it
to remain hidden.

Chromium, Firefox, and WebKit have automated browser checks for the native
interaction, fallback, focus, layout, and failure states. Automated checks don’t
establish full accessibility conformance; a manual screen-reader review is still
needed before release.

## Development

```sh
npm ci
npm run test:run
npm run test:types
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
npm run lint
npm run test:coverage
npm audit --omit=dev
```

Use test-driven development. Tests cover image preservation, commands, labels,
text-only insertion, lifecycle cleanup, declaration imports, package contents,
and release automation. Browser checks cover native focus and keyboard behavior,
long content, narrow screens, translations, and no-JavaScript/module-failure
fallbacks. The CDN tests route unpublished URLs to the local source; they don’t
claim a future package is available from the CDN.

## Publishing

The starter’s release hooks remain intact:

- `version`: `node scripts/update-demo-versions.js && git add demo/esm.html`
- `postversion`: `git push --follow-tags`

When explicitly releasing, `npm version minor` updates package metadata and the
versioned CDN demo, creates the version commit and annotated tag, and pushes the
branch and tag. Don’t run it merely to test readiness.

The tag-triggered `publish.yml` workflow uses npm trusted publishing. Reserve
the package and configure npm’s trusted publisher before the first automated
release: owner `aarongustafson`, repository `img-alt-overlay`, workflow filename
`publish.yml`, and no environment. The workflow’s manual dry-run option doesn’t
publish. No version bump or publication is part of this initial implementation.

## License

[MIT](./LICENSE).
