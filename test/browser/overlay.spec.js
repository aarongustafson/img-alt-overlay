import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/demo/');
	await expect(page.locator('#basic [data-alt-trigger]')).toBeVisible();
});

test('commands open a named non-modal dialog without duplicate opening calls', async ({
	page,
}) => {
	await page.evaluate(() => {
		const dialog = document.querySelector('#basic dialog');
		window.scriptOpens = 0;
		const show = dialog.show.bind(dialog);
		dialog.show = () => {
			window.scriptOpens++;
			show();
		};
	});
	const trigger = page.locator('#basic [data-alt-trigger]');
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Image description' });
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('[data-alt-text]')).toBeFocused();
	expect(await dialog.evaluate((node) => node.matches(':modal'))).toBe(false);
	expect(await page.evaluate(() => window.scriptOpens)).toBe(1);
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	await expect(trigger).toHaveText('Close');
	await trigger.click();
	await expect(dialog).not.toBeVisible();
	await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	await expect(trigger).toHaveText('View alt text');
});

test('keyboard operation, no focus trap, Escape and focus restoration', async ({
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
	await expect(page.locator('#french [data-alt-trigger]')).toBeFocused();
	await expect(dialog).toBeVisible();
	await dialog.locator('[data-alt-close]').focus();
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
	await page.locator('#basic [data-alt-trigger]').click();
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
	await expect(page.locator('#french [data-alt-trigger]')).toHaveText(
		'Fermer',
	);
	await page.locator('#french [data-alt-trigger]').click();
	await page.locator('#arabic [data-alt-trigger]').click();
	const dialog = page.getByRole('dialog', { name: 'وصف الصورة' });
	await expect(dialog).toBeVisible();
	expect(
		await dialog.evaluate((node) => getComputedStyle(node).direction),
	).toBe('rtl');
});

test('dialog stays within the image block and long content remains scrollable', async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 480 });
	await page.locator('#basic img').evaluate((image) => {
		image.alt = 'A detailed image description. '.repeat(200);
	});
	await page.locator('#basic [data-alt-trigger]').click();
	const dialog = page.locator('#basic dialog');
	const image = await page.locator('#basic img').boundingBox();
	const box = await dialog.boundingBox();
	expect(box.x).toBeGreaterThanOrEqual(image.x);
	expect(box.y).toBeGreaterThanOrEqual(image.y);
	expect(box.x + box.width).toBeLessThanOrEqual(image.x + image.width + 1);
	expect(box.y + box.height).toBeLessThanOrEqual(image.y + image.height + 1);
	expect(
		await dialog.evaluate((node) => node.scrollHeight > node.clientHeight),
	).toBe(true);
	await dialog.locator('[data-alt-close]').focus();
	await dialog.locator('[data-alt-close]').click();
	await expect(dialog).not.toBeVisible();
	await page.locator('#basic [data-alt-trigger]').click();
	await page.locator('#basic [data-alt-trigger]').click();
	await expect(dialog).not.toBeVisible();
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth),
	).toBeLessThanOrEqual(320);
});

test('the layout layer does not intercept clicks on a linked image', async ({
	page,
}) => {
	const image = page.locator('#linked img');
	const box = await image.boundingBox();
	await image.click({ position: { x: box.width / 2, y: box.height / 2 } });
	await expect(page).toHaveURL(/\/demo\/bicycle\.svg$/);
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

test('disconnect closes the inline dialog and reconnect creates one fresh set of controls', async ({
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
	await page.locator('#basic [data-alt-trigger]').click();
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

test('wide overlays stay local and leave the rest of the page interactive', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.locator('#basic [data-alt-trigger]').click();
	const image = await page.locator('#basic img').boundingBox();
	const dialog = await page.locator('#basic dialog').boundingBox();
	expect(dialog.x).toBeGreaterThanOrEqual(image.x);
	expect(dialog.y).toBeGreaterThanOrEqual(image.y);
	expect(dialog.x + dialog.width).toBeLessThanOrEqual(
		image.x + image.width + 1,
	);
	expect(dialog.y + dialog.height).toBeLessThanOrEqual(
		image.y + image.height + 1,
	);
	await page.locator('#french [data-alt-trigger]').click();
	await expect(page.locator('#basic dialog')).toBeVisible();
	await expect(page.locator('#french dialog')).toBeVisible();
});

test('Close is visually hidden until focused, but stays keyboard reachable', async ({
	page,
}) => {
	await page.locator('#basic [data-alt-trigger]').click();
	const close = page.locator('#basic [data-alt-close]');
	const before = await close.boundingBox();
	expect(before.width).toBeLessThanOrEqual(1);
	expect(before.height).toBeLessThanOrEqual(1);
	expect(
		await close.evaluate((node) => getComputedStyle(node).clipPath),
	).toBe('inset(50%)');
	await close.focus();
	const focused = await close.boundingBox();
	expect(focused.width).toBeGreaterThan(1);
	expect(focused.height).toBeGreaterThanOrEqual(44);
	expect(
		await close.evaluate((node) => getComputedStyle(node).clipPath),
	).toBe('none');
	await close.click();
	await expect(page.locator('#basic dialog')).not.toBeVisible();
});

test('description has no margin or focus ring and centers inside an overridable minimum panel', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	const host = page.locator('#basic');
	await host.locator('img').evaluate((image) => {
		image.alt = 'A bicycle.';
	});
	await host.locator('[data-alt-trigger]').focus();
	await page.keyboard.press('Enter');
	const dialog = host.locator('dialog');
	const text = host.locator('[data-alt-text]');
	await expect(text).toBeFocused();
	await expect(text).toHaveCSS('margin-block-end', '0px');
	await expect(text).toHaveCSS('outline-style', 'none');
	await expect(text).toHaveCSS('text-align', 'center');
	const area = await host.locator('[data-alt-ui]').boundingBox();
	const panel = await dialog.boundingBox();
	const description = await text.boundingBox();
	expect(panel.height).toBeCloseTo(area.height * 0.3, 0);
	expect(description.x + description.width / 2).toBeCloseTo(
		panel.x + panel.width / 2,
		0,
	);
	expect(description.y + description.height / 2).toBeCloseTo(
		panel.y + panel.height / 2,
		0,
	);
	await host.evaluate((node) => {
		node.style.setProperty('--img-alt-dialog-min-block-size', '55%');
	});
	expect((await dialog.boundingBox()).height).toBeCloseTo(
		area.height * 0.55,
		0,
	);
	await host.evaluate((node) => {
		node.style.setProperty('--img-alt-dialog-min-block-size', '200%');
	});
	expect((await dialog.boundingBox()).height).toBeLessThanOrEqual(
		area.height + 1,
	);
});

for (const [id, label, direction] of [
	['basic', 'Close', 'ltr'],
	['arabic', 'إغلاق', 'rtl'],
]) {
	test(`icon Close stays at the dialog corner without resizing it in ${direction}`, async ({
		page,
		browserName,
	}) => {
		const host = page.locator(`#${id}`);
		await host.locator('[data-alt-trigger]').click();
		const dialog = host.locator('dialog');
		const close = host.locator('[data-alt-close]');
		await expect(close).toHaveAccessibleName(label);
		await expect(close).toHaveText('\u2715');
		const before = await dialog.boundingBox();
		await page.keyboard.press(
			browserName === 'webkit' && process.platform === 'darwin'
				? 'Alt+Tab'
				: 'Tab',
		);
		await expect(close).toBeFocused();
		const after = await dialog.boundingBox();
		expect(after).toEqual(before);
		await expect(close).toHaveCSS('position', 'absolute');
		await expect(close).toHaveCSS('border-top-width', '0px');
		await expect(close).toHaveCSS('outline-style', 'solid');
		await expect(close).toHaveCSS('outline-width', '3px');
		const button = await close.boundingBox();
		expect(button.height).toBeCloseTo(44, 3);
		expect(button.width).toBeCloseTo(44, 3);
		expect(button.y - after.y).toBeCloseTo(10, 0);
		const end =
			direction === 'rtl'
				? button.x - after.x
				: after.x + after.width - button.x - button.width;
		expect(button.y - after.y).toBeGreaterThanOrEqual(8);
		expect(end).toBeGreaterThanOrEqual(8);
		expect(end).toBeCloseTo(10, 0);
		await close.click();
		await expect(dialog).not.toBeVisible();
	});
}

test('a narrow image shows the description rather than only its dialog heading', async ({
	page,
}) => {
	await page.locator('#basic [data-alt-trigger]').click();
	await page.setViewportSize({ width: 320, height: 640 });
	const geometry = await page.locator('#basic dialog').evaluate((dialog) => {
		const range = document.createRange();
		const text = dialog.querySelector('[data-alt-text]').firstChild;
		range.setStart(text, 0);
		range.setEnd(text, 1);
		const letter = range.getBoundingClientRect();
		const panel = dialog.getBoundingClientRect();
		return {
			top: letter.top,
			bottom: letter.bottom,
			panelTop: panel.top,
			panelBottom: panel.bottom,
		};
	});
	expect(geometry.top).toBeGreaterThanOrEqual(geometry.panelTop);
	expect(geometry.bottom).toBeLessThanOrEqual(geometry.panelBottom);
});

for (const width of [1280, 320]) {
	test(`site-style overlay is full-width, borderless, white on black at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		const host = page.locator('#site-style');
		const trigger = host.locator('[data-alt-trigger]');
		await trigger.click();
		const dialog = host.locator('dialog');
		const image = await host.locator('img').boundingBox();
		const panel = await dialog.boundingBox();
		expect(panel.x).toBeCloseTo(image.x, 0);
		expect(panel.width).toBeCloseTo(image.width, 0);
		expect(panel.y).toBeGreaterThanOrEqual(image.y);
		expect(panel.y + panel.height).toBeLessThanOrEqual(
			image.y + image.height + 1,
		);
		expect(
			await dialog.evaluate((node) => {
				const style = getComputedStyle(node);
				return {
					color: style.color,
					background: style.backgroundColor,
					border: [
						style.borderTopWidth,
						style.borderRightWidth,
						style.borderBottomWidth,
						style.borderLeftWidth,
					],
					radius: style.borderRadius,
				};
			}),
		).toEqual({
			color: 'rgb(255, 255, 255)',
			background: 'rgb(0, 0, 0)',
			border: ['0px', '0px', '0px', '0px'],
			radius: '0px',
		});
		await trigger.click();
		await expect(dialog).not.toBeVisible();
		await trigger.click();
		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible();
	});
}

test('logical inset properties independently position the button and all four overlay edges', async ({
	page,
}) => {
	const host = page.locator('#basic');
	await host.evaluate((node) => {
		for (const [name, value] of Object.entries({
			'--img-alt-button-inset-block-start': 'auto',
			'--img-alt-button-inset-block-end': '12px',
			'--img-alt-button-inset-inline-start': '16px',
			'--img-alt-button-inset-inline-end': 'auto',
			'--img-alt-overlay-inset-block-start': '10px',
			'--img-alt-overlay-inset-block-end': '14px',
			'--img-alt-overlay-inset-inline-start': '20px',
			'--img-alt-overlay-inset-inline-end': '24px',
		}))
			node.style.setProperty(name, value);
	});
	const image = await host.locator('img').boundingBox();
	const button = await host.locator('[data-alt-trigger]').boundingBox();
	const area = await host.locator('[data-alt-ui]').boundingBox();
	expect(button.x - image.x).toBeCloseTo(16, 0);
	expect(image.y + image.height - button.y - button.height).toBeCloseTo(
		12,
		0,
	);
	expect(area.x - image.x).toBeCloseTo(20, 0);
	expect(area.y - image.y).toBeCloseTo(10, 0);
	expect(image.x + image.width - area.x - area.width).toBeCloseTo(24, 0);
	expect(image.y + image.height - area.y - area.height).toBeCloseTo(14, 0);
});

test('logical inline inset properties follow right-to-left direction', async ({
	page,
}) => {
	const host = page.locator('#arabic');
	await host.evaluate((node) => {
		node.style.setProperty('--img-alt-button-inset-inline-end', '20px');
		node.style.setProperty('--img-alt-overlay-inset-inline-start', '12px');
		node.style.setProperty('--img-alt-overlay-inset-inline-end', '18px');
	});
	const image = await host.locator('img').boundingBox();
	const button = await host.locator('[data-alt-trigger]').boundingBox();
	const area = await host.locator('[data-alt-ui]').boundingBox();
	expect(button.x - image.x).toBeCloseTo(20, 0);
	expect(area.x - image.x).toBeCloseTo(18, 0);
	expect(image.x + image.width - area.x - area.width).toBeCloseTo(12, 0);
});

for (const width of [1280, 320]) {
	for (const id of ['basic', 'slide-up']) {
		test(`${id} minimum fits the Close button and its focus ring at ${width}px`, async ({
			page,
			browserName,
		}) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			const host = page.locator(`#${id}`);
			await host.locator('img').evaluate((image, bounded) => {
				image.alt = 'A bicycle.';
				if (bounded) image.style.blockSize = '168px';
			}, id === 'basic');
			const dialog = host.locator('dialog');
			await expect(dialog.locator('[data-alt-text]')).toHaveText(
				'A bicycle.',
			);
			await host.locator('[data-alt-trigger]').click();
			const panel = await dialog.boundingBox();
			expect(panel.height).toBeGreaterThanOrEqual(64);
			await page.keyboard.press(
				browserName === 'webkit' && process.platform === 'darwin'
					? 'Alt+Tab'
					: 'Tab',
			);
			const close = host.locator('[data-alt-close]');
			await expect(close).toBeFocused();
			await expect(close).toHaveCSS('outline-style', 'solid');
			expect(await dialog.boundingBox()).toEqual(panel);
			const focus = await close.evaluate((button) => {
				const bounds = button.getBoundingClientRect();
				const style = getComputedStyle(button);
				const extra =
					parseFloat(style.outlineWidth) +
					parseFloat(style.outlineOffset);
				return {
					top: bounds.top - extra,
					right: bounds.right + extra,
					bottom: bounds.bottom + extra,
					left: bounds.left - extra,
				};
			});
			expect(focus.top).toBeGreaterThanOrEqual(panel.y - 0.5);
			expect(focus.left).toBeGreaterThanOrEqual(panel.x - 0.5);
			expect(focus.bottom).toBeLessThanOrEqual(
				panel.y + panel.height + 0.5,
			);
			expect(focus.right).toBeLessThanOrEqual(
				panel.x + panel.width + 0.5,
			);
			const overflow = await dialog.evaluate((node) => ({
				client: node.clientHeight,
				scroll: node.scrollHeight,
			}));
			expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
			await close.click();
			await expect(dialog).not.toBeVisible();
			if (id === 'basic') {
				await host.locator('img').evaluate((image) => {
					image.style.blockSize = '116px';
				});
				await host.locator('[data-alt-trigger]').click();
				const available = await host
					.locator('[data-alt-ui]')
					.boundingBox();
				expect(available.height).toBeCloseTo(48, 0);
				expect((await dialog.boundingBox()).height).toBeLessThanOrEqual(
					available.height + 0.5,
				);
				await page.keyboard.press('Escape');
				await expect(dialog).not.toBeVisible();
			}
		});
	}

	for (const reducedMotion of ['no-preference', 'reduce']) {
		test(`CSS slide-up demo anchors at block end and inline edges at ${width}px with motion ${reducedMotion}`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ reducedMotion });
			const exitSupported = await page.evaluate(async () => {
				const probe = document.createElement('dialog');
				probe.style.transition = 'display 1s allow-discrete';
				document.body.append(probe);
				try {
					probe.show();
					probe.getBoundingClientRect();
					await new Promise((resolve) =>
						requestAnimationFrame(() =>
							requestAnimationFrame(resolve),
						),
					);
					probe.close();
					return probe
						.getAnimations()
						.some(
							(animation) =>
								animation.transitionProperty === 'display',
						);
				} finally {
					probe.remove();
				}
			});
			if (reducedMotion === 'no-preference' && !exitSupported) {
				test.info().annotations.push({
					type: 'browser limitation',
					description:
						'Native dialog display transitions are unavailable; closing must remain immediate.',
				});
			}
			const host = page.locator('#slide-up');
			const trigger = host.locator('[data-alt-trigger]');
			const dialog = host.locator('dialog');
			await dialog.evaluate((node) => {
				node.addEventListener('transitionrun', () => {
					for (const animation of node.getAnimations())
						animation.pause();
				});
			});
			await trigger.focus();
			await trigger.press('Enter');
			const animated = await dialog.evaluate((node) => {
				const animations = node.getAnimations();
				if (!animations.length) return { count: 0 };
				for (const animation of animations) {
					animation.pause();
					animation.currentTime = 150;
				}
				const opacity = Number(getComputedStyle(node).opacity);
				const displacement = new DOMMatrixReadOnly(
					getComputedStyle(node).transform,
				).m42;
				const properties = animations.map(
					(animation) => animation.transitionProperty,
				);
				for (const animation of animations) animation.finish();
				return {
					count: animations.length,
					displacement,
					opacity,
					properties,
					height: node.getBoundingClientRect().height,
				};
			});
			if (reducedMotion === 'reduce') expect(animated.count).toBe(0);
			else {
				expect(animated.properties).toEqual(
					expect.arrayContaining(['opacity', 'transform']),
				);
				expect(animated.opacity).toBeGreaterThan(0);
				expect(animated.opacity).toBeLessThan(1);
				expect(animated.displacement).toBeGreaterThan(0);
				expect(animated.displacement).toBeLessThan(animated.height);
			}
			await expect(dialog).toHaveCSS('opacity', '1');
			const image = await host.locator('img').boundingBox();
			const panel = await dialog.boundingBox();
			expect(panel.x).toBeCloseTo(image.x, 0);
			expect(panel.width).toBeCloseTo(image.width, 0);
			expect(panel.y + panel.height).toBeCloseTo(
				image.y + image.height,
				0,
			);
			await expect(host.locator('[data-alt-ui]')).toHaveCSS(
				'overflow',
				'clip',
			);
			await trigger.focus();
			await trigger.press('Enter');
			await expect(trigger).toHaveAttribute('aria-expanded', 'false');
			await expect(trigger).toBeFocused();
			const closing = await dialog.evaluate((node) => {
				const animations = node.getAnimations();
				for (const animation of animations) {
					animation.pause();
					animation.currentTime = 150;
				}
				const style = getComputedStyle(node);
				const close = node.querySelector('[data-alt-close]');
				close.focus();
				return {
					open: node.open,
					closedControlFocused:
						node.ownerDocument.activeElement === close,
					display: style.display,
					opacity: Number(style.opacity),
					displacement: new DOMMatrixReadOnly(style.transform).m42,
					properties: animations.map(
						(animation) => animation.transitionProperty,
					),
				};
			});
			expect(closing.open).toBe(false);
			expect(closing.closedControlFocused).toBe(false);
			if (reducedMotion === 'reduce' || !exitSupported) {
				expect(closing.properties).toEqual([]);
				expect(closing.display).toBe('none');
			} else {
				expect(closing.properties).toEqual(
					expect.arrayContaining(['display', 'opacity', 'transform']),
				);
				expect(closing.display).not.toBe('none');
				expect(closing.opacity).toBeGreaterThan(0);
				expect(closing.opacity).toBeLessThan(1);
				expect(closing.displacement).toBeGreaterThan(0);
				expect(closing.displacement).toBeLessThan(panel.height);
				const reopening = await dialog.evaluate((node) => {
					node.closest('img-alt-overlay')
						.querySelector('[data-alt-trigger]')
						.click();
					const animations = node.getAnimations();
					for (const animation of animations) {
						animation.pause();
						animation.currentTime = 0;
					}
					const opacity = Number(getComputedStyle(node).opacity);
					for (const animation of animations) animation.finish();
					return { open: node.open, opacity };
				});
				expect(reopening.open).toBe(true);
				expect(reopening.opacity).toBeCloseTo(closing.opacity, 2);
				await expect(trigger).toHaveAttribute('aria-expanded', 'true');
				await page.keyboard.press('Escape');
				await expect(trigger).toHaveAttribute('aria-expanded', 'false');
				await dialog.evaluate((node) => {
					for (const animation of node.getAnimations())
						animation.finish();
				});
				await expect(trigger).toBeFocused();
			}
			await expect(dialog).not.toBeVisible();
		});
	}
}
