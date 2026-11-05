import { ImgAltOverlayElement } from './img-alt-overlay.js';

export function defineComponentName(tagName = 'img-alt-overlay') {
	const hasWindow = typeof window !== 'undefined';
	const registry = hasWindow ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	if (!registry.get(tagName)) {
		registry.define(tagName, ImgAltOverlayElement);
	}

	return true;
}

defineComponentName();
