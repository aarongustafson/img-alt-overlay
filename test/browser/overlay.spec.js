import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/demo/');
	await expect(page.locator('#basic [data-alt-trigger]')).toBeVisible();
});

test('native commands open and close a named modal dialog without JS command calls', async ({
	page,
}) => {
	const nativeCommands = await page.evaluate(
		() => 'commandForElement' in HTMLButtonElement.prototype,
	);
	await page.evaluate(() => {
		const dialog = document.querySelector('#basic dialog');
		window.scriptOpens = 0;
		const show = dialog.showModal.bind(dialog);
		dialog.showModal = () => {
			window.scriptOpens++;
			show();
		};
	});
	const trigger = page.locator('#basic [data-alt-trigger]');
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Image description' });
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('[data-alt-text]')).toBeFocused();
	expect(await dialog.evaluate((node) => node.matches(':modal'))).toBe(true);
	expect(await page.evaluate(() => window.scriptOpens)).toBe(
		nativeCommands ? 0 : 1,
	);
	await dialog.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(dialog).not.toBeVisible();
});

test('keyboard operation, focus containment, Escape and focus restoration', async ({
	page,
	browserName,
}) => {
	const tab =
		browserName === 'webkit' && process.platform === 'darwin'
			? 'Alt+Tab'
			: 'Tab';
	const trigger = page.locator('#basic [data-alt-trigger]');
	await trigger.focus();
	await page.keyboard.press('Enter');
	const dialog = page.locator('#basic dialog');
	await expect(dialog).toBeVisible();
	await page.keyboard.press(tab);
	await expect(dialog.locator('[data-alt-close]')).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(dialog).not.toBeVisible();
	await expect(trigger).toBeFocused();
	await page.keyboard.press('Enter');
	await page.keyboard.press(tab);
	await page.keyboard.press(tab);
	expect(
		await page.evaluate(() => {
			const dialog = document.querySelector('#basic dialog');
			return (
				dialog.contains(document.activeElement) ||
				document.activeElement === document.body
			);
		}),
	).toBe(true);
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
	await expect(trigger).toBeFocused();
});

test('command fallback uses native dialog methods when commands are unavailable', async ({
	page,
}) => {
	await page.evaluate(async () => {
		delete HTMLButtonElement.prototype.commandForElement;
		const element = document.querySelector('#basic');
		element.refresh();
		// Remove native command attributes to emulate a browser that ignores them.
		for (const button of element.querySelectorAll('button'))
			button.removeAttribute('commandfor');
	});
	await page.locator('#basic [data-alt-trigger]').click();
	await expect(page.locator('#basic dialog')).toBeVisible();
	await page.locator('#basic [data-alt-close]').click();
	await expect(page.locator('#basic dialog')).not.toBeVisible();
});

test('preserves links, responsive picture markup, and empty-alt behavior', async ({
	page,
}) => {
	expect(await page.locator('#linked picture source').count()).toBe(1);
	await expect(page.locator('#linked a')).toHaveAttribute(
		'href',
		'./bicycle.svg',
	);
	await expect(page.locator('#decorative button')).toHaveCount(0);
	await expect(page.locator('#missing button')).toHaveCount(0);
	expect(await page.locator('#basic img').getAttribute('alt')).toBe(
		'A red bicycle beside a blue wall, with a basket on its handlebars.',
	);
});

test('live alt updates preserve an open dialog; removing alt closes it', async ({
	page,
}) => {
	await page.locator('#basic [data-alt-trigger]').click();
	await page.locator('#basic img').evaluate((image) => {
		image.alt = 'Updated bicycle description.';
	});
	await expect(page.locator('#basic dialog')).toBeVisible();
	await expect(page.locator('#basic [data-alt-text]')).toHaveText(
		'Updated bicycle description.',
	);
	await page.locator('#basic img').evaluate((image) => {
		image.alt = '';
	});
	await expect(page.locator('#basic dialog')).toHaveCount(0);
	await expect(page.locator('#basic img')).toBeVisible();
});

test('French and RTL labels name their dialogs and controls', async ({
	page,
}) => {
	await page.locator('#french [data-alt-trigger]').click();
	await expect(
		page.getByRole('dialog', { name: 'Description de l’image' }),
	).toBeVisible();
	await page.getByRole('button', { name: 'Fermer', exact: true }).click();
	await page.locator('#arabic [data-alt-trigger]').click();
	const dialog = page.getByRole('dialog', { name: 'وصف الصورة' });
	await expect(dialog).toBeVisible();
	expect(
		await dialog.evaluate((node) => getComputedStyle(node).direction),
	).toBe('rtl');
});

test('dialog fits a narrow viewport and long content remains scrollable', async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 480 });
	await page.locator('#basic img').evaluate((image) => {
		image.alt = 'A detailed image description. '.repeat(200);
	});
	await page.locator('#basic [data-alt-trigger]').click();
	const dialog = page.locator('#basic dialog');
	const box = await dialog.boundingBox();
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(320);
	expect(box.height).toBeLessThanOrEqual(480);
	await dialog.locator('[data-alt-close]').click();
	await expect(dialog).not.toBeVisible();
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth),
	).toBeLessThanOrEqual(320);
});

test('no JavaScript and failed modules preserve visible images without dead controls', async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const fallback = await context.newPage();
	try {
		await fallback.goto('http://127.0.0.1:4177/demo/');
		await expect(fallback.locator('#basic img')).toBeVisible();
		await expect(fallback.locator('img-alt-overlay button')).toHaveCount(0);
	} finally {
		await context.close();
	}
});

test('failed module fetch leaves native images and links usable', async ({
	page,
}) => {
	await page.route('**/define.js', (route) => route.abort());
	await page.goto('/demo/');
	await expect(page.locator('#basic img')).toBeVisible();
	await expect(page.locator('img-alt-overlay button')).toHaveCount(0);
	await expect(page.locator('#linked a')).toHaveAttribute(
		'href',
		'./bicycle.svg',
	);
});

test('disconnect closes the top-layer dialog and reconnect creates one fresh set of controls', async ({
	page,
}) => {
	await page.locator('#basic [data-alt-trigger]').click();
	await page.evaluate(() => {
		const element = document.querySelector('#basic');
		const parent = element.parentElement;
		element.remove();
		window.detachedDialogCount = element.querySelectorAll('dialog').length;
		parent.append(element);
	});
	expect(await page.evaluate(() => window.detachedDialogCount)).toBe(0);
	await expect(page.locator('#basic dialog')).toHaveCount(1);
	await expect(page.locator('#basic dialog')).not.toBeVisible();
	await page.locator('#basic [data-alt-trigger]').click();
	await expect(page.locator('#basic dialog')).toBeVisible();
});

test('focus restoration can refresh the wrapper without leaking duplicate UI', async ({
	page,
}) => {
	const trigger = page.locator('#basic [data-alt-trigger]');
	await trigger.focus();
	await page.keyboard.press('Enter');
	await page.evaluate(() => {
		const element = document.querySelector('#basic');
		let ready = 0;
		element.addEventListener('img-alt-overlay:ready', () => {
			ready++;
		});
		element
			.querySelector('[data-alt-trigger]')
			.addEventListener('focus', () => element.refresh(), { once: true });
		element.refresh();
		window.refreshResult = { ready, state: element.state };
	});
	expect(await page.evaluate(() => window.refreshResult)).toEqual({
		ready: 1,
		state: 'ready',
	});
	await expect(page.locator('#basic dialog')).toHaveCount(1);
	await expect(page.locator('#basic [data-alt-trigger]')).toHaveCount(1);
});

test('the fallback tolerates a focus handler disconnecting the wrapper during opening', async ({
	page,
}) => {
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.evaluate(() => {
		delete HTMLButtonElement.prototype.commandForElement;
		const element = document.querySelector('#basic');
		element.refresh();
		for (const button of element.querySelectorAll('button'))
			button.removeAttribute('commandfor');
		element
			.querySelector('[data-alt-text]')
			.addEventListener('focus', () => {
				element.remove();
				window.removedOverlay = element;
			});
	});
	await page.locator('#basic [data-alt-trigger]').click();
	await expect(page.locator('#basic')).toHaveCount(0);
	expect(
		await page.evaluate(() => ({
			state: window.removedOverlay.state,
			images: window.removedOverlay.querySelectorAll('img').length,
			dialogs: window.removedOverlay.querySelectorAll('dialog').length,
		})),
	).toEqual({ state: 'idle', images: 1, dialogs: 0 });
	expect(errors).toEqual([]);
});

test('generated buttons never submit their containing form', async ({
	page,
}) => {
	await page.evaluate(() => {
		const form = document.createElement('form');
		const element = document.querySelector('#basic');
		element.before(form);
		form.append(element);
		window.submitted = false;
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			window.submitted = true;
		});
	});
	await page.locator('#basic [data-alt-trigger]').click();
	await page.locator('#basic [data-alt-close]').click();
	expect(await page.evaluate(() => window.submitted)).toBe(false);
});

test('malformed demo requests return 400 without terminating the server', async ({
	request,
}) => {
	for (const path of ['/bad%00path', '/bad%ZZpath']) {
		expect((await request.get(path)).status()).toBe(400);
	}
	expect((await request.get('/demo/')).status()).toBe(200);
});
