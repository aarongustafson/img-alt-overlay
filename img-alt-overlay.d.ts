/**
 * A light-DOM image wrapper with a non-modal, in-image alt-text dialog.
 * @cssprop --img-alt-button-inset-block-start - Opener block-start inset (0.5rem).
 * @cssprop --img-alt-button-inset-block-end - Opener block-end inset (auto).
 * @cssprop --img-alt-button-inset-inline-start - Opener inline-start inset (auto).
 * @cssprop --img-alt-button-inset-inline-end - Opener inline-end inset (0.5rem).
 * @cssprop --img-alt-overlay-inset-block-start - Overlay area block-start inset (3.75rem).
 * @cssprop --img-alt-overlay-inset-block-end - Overlay area block-end inset (0.5rem).
 * @cssprop --img-alt-overlay-inset-inline-start - Overlay area inline-start inset (0.5rem).
 * @cssprop --img-alt-overlay-inset-inline-end - Overlay area inline-end inset (0.5rem).
 */
export class ImgAltOverlayElement extends HTMLElement {
	static readonly observedAttributes: string[];
	readonly state: 'idle' | 'inactive' | 'ready' | 'error';
	/** Reread image structure and labels. Closes any open dialog. */
	refresh(): void;
}

declare global {
	interface HTMLElementTagNameMap {
		'img-alt-overlay': ImgAltOverlayElement;
	}
	interface HTMLElementEventMap {
		'img-alt-overlay:ready': CustomEvent<void>;
		'img-alt-overlay:error': CustomEvent<{ error: Error }>;
	}
}
