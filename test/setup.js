import { beforeAll } from 'vitest';
import { ImgAltOverlayElement } from '../img-alt-overlay.js';

const elementName = 'img-alt-overlay'.toLowerCase();

// Define the custom element before tests run
beforeAll(() => {
	if (!customElements.get(elementName)) {
		customElements.define(elementName, ImgAltOverlayElement);
	}

	// Make the class available globally for testing static methods
	globalThis.ImgAltOverlayElement = ImgAltOverlayElement;
});
