import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImgAltOverlayElement } from '../img-alt-overlay.js';

async function mount(
	markup = '<img src="photo.jpg" alt="A red bicycle.">',
	attributes = '',
) {
	const host = document.createElement('div');
	host.innerHTML = `<img-alt-overlay ${attributes}>${markup}</img-alt-overlay>`;
	document.body.append(host);
	await settle();
	return host.firstElementChild;
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('image alt dialog', () => {
	it('keeps disconnected state when closing an emptied description disconnects the host', async () => {
		const element = await mount();
		const dialog = element.querySelector('dialog');
		dialog.setAttribute('open', '');
		vi.spyOn(dialog, 'close').mockImplementation(() => element.remove());
		element.querySelector('img').alt = '';
		await settle();
		expect(element.state).toBe('idle');
		expect(element.querySelector('dialog')).toBeNull();
	});

	it('does not reinitialize again when dialog focus restoration reenters refresh', async () => {
		const element = await mount();
		const dialog = element.querySelector('dialog');
		dialog.setAttribute('open', '');
		const observe = vi.spyOn(MutationObserver.prototype, 'observe');
		vi.spyOn(dialog, 'close').mockImplementation(() => element.refresh());
		element.refresh();
		expect(observe).toHaveBeenCalledTimes(1);
		expect(element.state).toBe('ready');
		expect(element.querySelectorAll('dialog')).toHaveLength(1);
	});

	it('does not claim images inside differently named overlay subclasses', async () => {
		const name = 'alternate-image-overlay';
		if (!customElements.get(name)) {
			customElements.define(name, class extends ImgAltOverlayElement {});
		}
		const element = await mount(
			`<${name}><img alt="Nested image"></${name}>`,
		);
		expect(element.state).toBe('error');
		expect(element.querySelector(':scope > button')).toBeNull();
	});

	it('preserves the authored image and uses light DOM', async () => {
		const element = await mount();
		expect(element).toBeInstanceOf(ImgAltOverlayElement);
		expect(element.shadowRoot).toBeNull();
		expect(element.state).toBe('ready');
		expect(element.querySelector('img').outerHTML).toBe(
			'<img src="photo.jpg" alt="A red bicycle.">',
		);
		expect(element.querySelector('dialog p').textContent).toBe(
			'A red bicycle.',
		);
	});

	it('generates native commands and a named dialog with a text focus target', async () => {
		const element = await mount();
		const trigger = element.querySelector('[data-alt-trigger]');
		const dialog = element.querySelector('dialog');
		expect(trigger.type).toBe('button');
		expect(trigger.getAttribute('command')).toBe('show-modal');
		expect(trigger.getAttribute('commandfor')).toBe(dialog.id);
		expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
		expect(
			element.querySelector('[data-alt-close]').getAttribute('command'),
		).toBe('close');
		expect(
			element.querySelector(`#${dialog.getAttribute('aria-labelledby')}`)
				.textContent,
		).toBe('Image description');
		expect(dialog.querySelector('p').tabIndex).toBe(-1);
		expect(dialog.querySelector('p').hasAttribute('autofocus')).toBe(true);
	});

	it.each(['<img alt="">', '<img>', '<img alt="   ">'])(
		'adds no UI for empty or missing alt: %s',
		async (markup) => {
			const element = await mount(markup);
			expect(element.state).toBe('inactive');
			expect(element.querySelector('button')).toBeNull();
		},
	);

	it('supports picture and linked images without moving their nodes', async () => {
		const markup =
			'<a href="/full.jpg"><picture><source srcset="wide.jpg"><img src="small.jpg" alt="A bicycle."></picture></a>';
		const element = await mount(markup);
		expect(element.firstElementChild.outerHTML).toBe(markup);
		expect(element.querySelector('a button')).toBeNull();
		expect(element.querySelectorAll('img')).toHaveLength(1);
	});

	it('takes all generated labels from authored attributes', async () => {
		const element = await mount(
			undefined,
			'lang="fr" button-label="Voir le texte alternatif" dialog-label="Description de l’image" close-label="Fermer"',
		);
		expect(element.querySelector('[data-alt-trigger]').textContent).toBe(
			'Voir le texte alternatif',
		);
		expect(element.querySelector('h2').textContent).toBe(
			'Description de l’image',
		);
		expect(element.querySelector('[data-alt-close]').textContent).toBe(
			'Fermer',
		);
	});

	it('treats alt and labels as plain text', async () => {
		const element = await mount(
			'<img alt="&lt;img src=x onerror=alert(1)&gt;">',
			'button-label="&lt;b&gt;Read&lt;/b&gt;"',
		);
		expect(element.querySelector('dialog p').textContent).toBe(
			'<img src=x onerror=alert(1)>',
		);
		expect(element.querySelector('[data-alt-trigger]').textContent).toBe(
			'<b>Read</b>',
		);
		expect(element.querySelector('dialog img, button b')).toBeNull();
	});

	it('keeps dialog IDs distinct for independent instances', async () => {
		const first = await mount();
		const second = await mount();
		expect(first.querySelector('dialog').id).not.toBe(
			second.querySelector('dialog').id,
		);
	});

	it('updates alternative text without rebuilding the dialog', async () => {
		const element = await mount();
		const dialog = element.querySelector('dialog');
		element.querySelector('img').alt = 'A blue bicycle.';
		await settle();
		expect(element.querySelector('dialog')).toBe(dialog);
		expect(dialog.querySelector('p').textContent).toBe('A blue bicycle.');
	});

	it('removes controls when alt is emptied and recovers when it returns', async () => {
		const element = await mount();
		element.querySelector('img').alt = '';
		await settle();
		expect(element.state).toBe('inactive');
		expect(element.querySelector('dialog')).toBeNull();
		element.querySelector('img').alt = 'Restored description.';
		await settle();
		expect(element.state).toBe('ready');
		expect(element.querySelector('dialog p').textContent).toBe(
			'Restored description.',
		);
	});

	it.each([
		['', 'exactly one image'],
		['<img alt="One"><img alt="Two">', 'exactly one image'],
		[
			'<img-alt-overlay><img alt="Nested"></img-alt-overlay>',
			'exactly one image',
		],
	])(
		'reports invalid image configuration and preserves authored markup',
		async (markup, message) => {
			const errors = [];
			const host = document.createElement('img-alt-overlay');
			host.innerHTML = markup;
			host.addEventListener('img-alt-overlay:error', (event) => {
				if (event.target === host) errors.push(event.detail.error);
			});
			document.body.append(host);
			await settle();
			expect(host.state).toBe('error');
			expect(errors).toHaveLength(1);
			expect(errors[0].message).toContain(message);
			expect(host.querySelector(':scope > button')).toBeNull();
		},
	);

	it('rejects empty translations rather than generating unnamed controls', async () => {
		const element = await mount(undefined, 'close-label=" "');
		expect(element.state).toBe('error');
		expect(element.querySelector('button')).toBeNull();
		element.setAttribute('close-label', 'Dismiss');
		await settle();
		expect(element.state).toBe('ready');
	});

	it('does not inject an interactive control inside an authored link', async () => {
		const link = document.createElement('a');
		link.href = '/full.jpg';
		link.innerHTML =
			'<img-alt-overlay><img alt="A bicycle."></img-alt-overlay>';
		document.body.append(link);
		await settle();
		expect(link.firstElementChild.state).toBe('error');
		expect(link.querySelector('button')).toBeNull();
	});

	it('restores authored DOM on disconnect and does not duplicate UI on reconnect', async () => {
		const element = await mount();
		const image = element.querySelector('img');
		const trigger = element.querySelector('button');
		element.remove();
		expect(element.state).toBe('idle');
		expect(element.children).toHaveLength(1);
		expect(element.firstElementChild).toBe(image);
		const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
		trigger.click();
		expect(show).not.toHaveBeenCalled();
		document.body.append(element);
		await settle();
		expect(element.querySelectorAll('dialog')).toHaveLength(1);
	});

	it('ignores queued setup after immediate disconnection', async () => {
		const element = document.createElement('img-alt-overlay');
		element.innerHTML = '<img alt="A bicycle.">';
		document.body.append(element);
		element.remove();
		await settle();
		expect(element.querySelector('button')).toBeNull();
		expect(element.state).toBe('idle');
	});

	it('refreshes after authored structural changes', async () => {
		const element = await mount();
		const image = document.createElement('img');
		image.alt = 'Replacement image.';
		element.querySelector('img').replaceWith(image);
		element.refresh();
		expect(element.querySelector('dialog p').textContent).toBe(
			'Replacement image.',
		);
	});

	it('uses the JS command fallback once and respects canceled clicks', async () => {
		const element = await mount();
		const dialog = element.querySelector('dialog');
		const show = vi.spyOn(dialog, 'showModal');
		const close = vi.spyOn(dialog, 'close');
		element.querySelector('[data-alt-trigger]').click();
		expect(show).toHaveBeenCalledTimes(1);
		element.querySelector('[data-alt-close]').click();
		expect(close).toHaveBeenCalledTimes(1);
		element
			.querySelector('[data-alt-trigger]')
			.addEventListener('click', (event) => {
				event.preventDefault();
			});
		element.querySelector('[data-alt-trigger]').click();
		expect(show).toHaveBeenCalledTimes(1);
	});

	it('leaves command execution to the browser when supported', async () => {
		vi.stubGlobal('CommandEvent', class extends Event {});
		Object.defineProperty(
			HTMLButtonElement.prototype,
			'commandForElement',
			{
				configurable: true,
				get() {
					return null;
				},
			},
		);
		try {
			const element = await mount();
			const show = vi.spyOn(element.querySelector('dialog'), 'showModal');
			element.querySelector('[data-alt-trigger]').click();
			expect(show).not.toHaveBeenCalled();
		} finally {
			delete HTMLButtonElement.prototype.commandForElement;
			vi.unstubAllGlobals();
		}
	});

	it('reports unsupported dialog APIs without adding dead controls', async () => {
		vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(
			undefined,
		);
		const original = HTMLDialogElement.prototype.showModal;
		HTMLDialogElement.prototype.showModal = undefined;
		try {
			const element = await mount();
			expect(element.state).toBe('error');
			expect(element.querySelector('button')).toBeNull();
		} finally {
			HTMLDialogElement.prototype.showModal = original;
		}
	});
});
