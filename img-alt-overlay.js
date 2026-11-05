const BaseElement = globalThis.HTMLElement ?? class {};
let nextId = 0;

/**
 * Reveal an image's alternative text in a native modal dialog.
 * @element img-alt-overlay
 */
export class ImgAltOverlayElement extends BaseElement {
	static observedAttributes = ['button-label', 'dialog-label', 'close-label'];

	constructor() {
		super();
		if (!this.ownerDocument) {
			throw new Error('ImgAltOverlayElement requires a browser DOM.');
		}
		this._state = 'idle';
		this._pending = false;
		this._image = null;
		this._ui = null;
		this._observer = null;
		this._revision = 0;
		this._onClick = (event) => {
			if (event.defaultPrevented || !this._ui) return;
			const button = event.target.closest?.('button');
			const { trigger, close, dialog } = this._ui;
			if (button === trigger) dialog.showModal();
			else if (button === close) dialog.close();
		};
	}

	get state() {
		return this._state;
	}

	connectedCallback() {
		this._schedule();
	}

	disconnectedCallback() {
		this._teardown();
	}

	attributeChangedCallback(name, previous, value) {
		if (previous !== value && this.isConnected) this._schedule();
	}

	_schedule() {
		if (this._pending) return;
		this._pending = true;
		queueMicrotask(() => {
			this._pending = false;
			if (this.isConnected) this.refresh();
		});
	}

	/** Reread image markup and labels, closing any open dialog. */
	refresh() {
		const revision = this._teardown();
		if (!this.isConnected || revision !== this._revision) return;
		try {
			const images = [...this.querySelectorAll('img')].filter((image) => {
				for (
					let parent = image.parentElement;
					parent;
					parent = parent.parentElement
				) {
					if (parent instanceof ImgAltOverlayElement)
						return parent === this;
				}
				return false;
			});
			if (images.length !== 1) {
				throw new Error('img-alt-overlay requires exactly one image.');
			}
			if (this.closest('a, button, label')) {
				throw new Error(
					'Place the image link inside img-alt-overlay, not around it; controls cannot be nested in a link, button, or label.',
				);
			}
			this._labels = {};
			for (const [attribute, fallback] of [
				['button-label', 'View alt text'],
				['dialog-label', 'Image description'],
				['close-label', 'Close'],
			]) {
				const value = this.getAttribute(attribute) ?? fallback;
				if (!value.trim())
					throw new Error(`${attribute} must not be empty.`);
				this._labels[attribute] = value;
			}
			this._image = images[0];
			const { MutationObserver } = this.ownerDocument.defaultView;
			this._observer = new MutationObserver(() => this._sync());
			this._observer.observe(this._image, {
				attributes: true,
				attributeFilter: ['alt'],
			});
			this._sync();
		} catch (error) {
			this._fail(error);
		}
	}

	_sync() {
		const revision = this._revision;
		const text = this._image?.getAttribute('alt') ?? '';
		if (!text.trim()) {
			this._removeUI();
			if (revision === this._revision) this._state = 'inactive';
			return;
		}
		try {
			const created = !this._ui;
			if (created) this._createUI();
			this._ui.text.textContent = text;
			this._state = 'ready';
			if (created) {
				this.dispatchEvent(
					new CustomEvent('img-alt-overlay:ready', {
						bubbles: true,
					}),
				);
			}
		} catch (error) {
			this._fail(error);
		}
	}

	_createUI() {
		const document = this.ownerDocument;
		const dialog = document.createElement('dialog');
		if (
			typeof dialog.showModal !== 'function' ||
			typeof dialog.close !== 'function'
		) {
			throw new Error('img-alt-overlay requires the native dialog API.');
		}
		const root = this.getRootNode();
		let id;
		do {
			id = `img-alt-overlay-${++nextId}`;
		} while (
			root.getElementById(`${id}-dialog`) ||
			root.getElementById(`${id}-heading`)
		);
		dialog.id = `${id}-dialog`;
		dialog.setAttribute('data-alt-dialog', '');
		dialog.setAttribute('aria-labelledby', `${id}-heading`);

		const heading = document.createElement('h2');
		heading.id = `${id}-heading`;
		heading.textContent = this._labels['dialog-label'];
		const text = document.createElement('p');
		text.tabIndex = -1;
		text.setAttribute('autofocus', '');
		text.setAttribute('data-alt-text', '');
		const trigger = document.createElement('button');
		trigger.type = 'button';
		trigger.textContent = this._labels['button-label'];
		trigger.setAttribute('data-alt-trigger', '');
		trigger.setAttribute('commandfor', dialog.id);
		trigger.setAttribute('command', 'show-modal');
		trigger.setAttribute('aria-controls', dialog.id);
		trigger.setAttribute('aria-haspopup', 'dialog');
		const close = document.createElement('button');
		close.type = 'button';
		close.textContent = this._labels['close-label'];
		close.setAttribute('data-alt-close', '');
		close.setAttribute('commandfor', dialog.id);
		close.setAttribute('command', 'close');
		dialog.append(heading, text, close);
		this._ui = { dialog, trigger, close, text };
		this.append(trigger, dialog);
		if (!('commandForElement' in trigger)) {
			this.addEventListener('click', this._onClick);
		}
	}

	_removeUI() {
		this.removeEventListener('click', this._onClick);
		if (!this._ui) return;
		const { dialog, trigger } = this._ui;
		this._ui = null;
		if (dialog.open) dialog.close();
		dialog.remove();
		trigger.remove();
	}

	_teardown() {
		const revision = ++this._revision;
		this._observer?.disconnect();
		this._observer = null;
		this._image = null;
		this._state = 'idle';
		this._removeUI();
		return revision;
	}

	_fail(error) {
		const revision = this._teardown();
		if (!this.isConnected || revision !== this._revision) return;
		this._state = 'error';
		this.dispatchEvent(
			new CustomEvent('img-alt-overlay:error', {
				detail: { error },
				bubbles: true,
			}),
		);
	}
}
