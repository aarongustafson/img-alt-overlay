/** A light-DOM image wrapper with a native modal alt-text dialog. */
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
