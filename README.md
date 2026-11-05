# img-alt-overlay Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/img-alt-overlay.svg)](https://www.npmjs.com/package/@aarongustafson/img-alt-overlay) [![Build Status](https://img.shields.io/github/actions/workflow/status/aarongustafson/img-alt-overlay/ci.yml?branch=main)](https://github.com/aarongustafson/img-alt-overlay/actions)

Reveal an image’s alternative text in a styleable disclosure overlay

## Demo

[Live Demo](https://aarongustafson.github.io/img-alt-overlay/demo/) ([Source](./demo/index.html))

Additional demos:
- [ESM CDN Demo](https://aarongustafson.github.io/img-alt-overlay/demo/esm.html) ([Source](./demo/esm.html))
- [Unpkg CDN Demo](https://aarongustafson.github.io/img-alt-overlay/demo/unpkg.html) ([Source](./demo/unpkg.html))

## Installation

```bash
npm install @aarongustafson/img-alt-overlay
```

## Usage

### Option 1: Auto-define the custom element (easiest)

Import the package to automatically define the `<img-alt-overlay>` custom element:

```javascript
import '@aarongustafson/img-alt-overlay';
```

Or use the define-only script in HTML:

```html
<script src="./node_modules/@aarongustafson/img-alt-overlay/define.js" type="module"></script>
```

### Option 2: Import the class and define manually

Import the class and define the custom element with your preferred tag name:

```javascript
import { ImgAltOverlayElement } from '@aarongustafson/img-alt-overlay/img-alt-overlay.js';

customElements.define('my-custom-name', ImgAltOverlayElement);
```

### Basic Example

```html
<img-alt-overlay>
  <!-- Your content here -->
</img-alt-overlay>
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `example-attribute` | `string` | `""` | Description of the attribute |

## Events

The component fires custom events that you can listen to:

| Event | Description | Detail |
|-------|-------------|--------|
| `img-alt-overlay:event` | Fired when something happens | `{ data }` |

### Example Event Handling

```javascript
const element = document.querySelector('img-alt-overlay');

element.addEventListener('img-alt-overlay:event', (event) => {
  console.log('Event fired:', event.detail);
});
```

## CSS Custom Properties

| Property | Default | Description |
|----------|---------|-------------|
| `--example-color` | `#000` | Example color property |

### Example Styling

```css
img-alt-overlay {
  --example-color: #ff0000;
}
```

## Browser Support

This component uses modern web standards:
- Custom Elements v1
- Shadow DOM v1
- ES Modules

For older browsers, you may need polyfills.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# View demo
open demo/index.html
```

## License

MIT © [Aaron Gustafson](https://www.aaron-gustafson.com/)
