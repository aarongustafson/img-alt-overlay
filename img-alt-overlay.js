const BaseElement = globalThis.HTMLElement ?? class {};
let nextId = 0;

/**
 * Reveal an image's alternative text in a non-modal, in-image dialog.
 * @element img-alt-overlay
 * @cssprop --img-alt-button-inset-block-start - Opener block-start inset (0.5rem).
 * @cssprop --img-alt-button-inset-block-end - Opener block-end inset (auto).
 * @cssprop --img-alt-button-inset-inline-start - Opener inline-start inset (auto).
 * @cssprop --img-alt-button-inset-inline-end - Opener inline-end inset (0.5rem).
 * @cssprop --img-alt-overlay-inset-block-start - Overlay area block-start inset (3.75rem).
 * @cssprop --img-alt-overlay-inset-block-end - Overlay area block-end inset (0.5rem).
 * @cssprop --img-alt-overlay-inset-inline-start - Overlay area inline-start inset (0.5rem).
 * @cssprop --img-alt-overlay-inset-inline-end - Overlay area inline-end inset (0.5rem).
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
			if (button === trigger) this._toggleDialog();
			else if (button === close) dialog.close();
		};
		this._onCommand = (event) => {
			const ui = this._ui;
			if (
				!event.defaultPrevented &&
				ui &&
				event.target === ui.dialog &&
				event.source === ui.trigger &&
				event.command === '--toggle-alt'
			) {
				this._toggleDialog();
			}
		};
		this._onKeyDown = (event) => {
			if (
				event.defaultPrevented ||
				event.key !== 'Escape' ||
				!this._ui?.dialog.open
			)
				return;
			event.preventDefault();
			this._toggleDialog();
		};
		this._onClose = (event) => {
			if (event.target === this._ui?.dialog) this._updateTrigger();
		};
	}

	_toggleDialog() {
		const ui = this._ui;
		if (!ui) return;
		if (ui.dialog.open) ui.dialog.close();
		else ui.dialog.show();
		if (this._ui === ui) this._updateTrigger();
	}

	_updateTrigger() {
		const { trigger, dialog } = this._ui;
		trigger.textContent =
			this._labels[dialog.open ? 'close-label' : 'button-label'];
		trigger.setAttribute('aria-expanded', String(dialog.open));
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
			typeof dialog.show !== 'function' ||
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
		trigger.setAttribute('command', '--toggle-alt');
		trigger.setAttribute('aria-controls', dialog.id);
		trigger.setAttribute('aria-haspopup', 'dialog');
		trigger.setAttribute('aria-expanded', 'false');
		const close = document.createElement('button');
		close.type = 'button';
		close.textContent = this._labels['close-label'];
		close.setAttribute('data-alt-close', '');
		close.setAttribute('commandfor', dialog.id);
		close.setAttribute('command', 'close');
		dialog.append(heading, text, close);
		const container = document.createElement('div');
		container.setAttribute('data-alt-ui', '');
		container.append(dialog);
		this._ui = { dialog, trigger, close, text, container };
		this.append(trigger, container);
		dialog.addEventListener('close', this._onClose);
		this.addEventListener('keydown', this._onKeyDown);
		if ('commandForElement' in trigger) {
			dialog.addEventListener('command', this._onCommand);
		} else {
			this.addEventListener('click', this._onClick);
		}
	}

	_removeUI() {
		this.removeEventListener('click', this._onClick);
		this.removeEventListener('keydown', this._onKeyDown);
		if (!this._ui) return;
		const { dialog, trigger, container } = this._ui;
		this._ui = null;
		dialog.removeEventListener('command', this._onCommand);
		dialog.removeEventListener('close', this._onClose);
		if (dialog.open) dialog.close();
		trigger.remove();
		container.remove();
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
