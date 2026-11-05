import { expect, test } from '@playwright/test';

test('versioned class-only CDN import registers manually and works', async ({
	page,
}) => {
	await page.route('https://esm.sh/**/img-alt-overlay.js*', (route) =>
		route.fulfill({
			path: 'img-alt-overlay.js',
			contentType: 'text/javascript',
		}),
	);
	await page.goto('/demo/esm.html');
	await page.getByRole('button', { name: 'View alt text' }).click();
	await expect(
		page.getByRole('dialog', { name: 'Image description' }),
	).toBeVisible();
	await page.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('failed CDN loading leaves a visible image without controls', async ({
	page,
}) => {
	await page.route('https://esm.sh/**', (route) => route.abort());
	await page.goto('/demo/esm.html');
	await expect(page.locator('img-alt-overlay img')).toBeVisible();
	await expect(page.locator('img-alt-overlay button')).toHaveCount(0);
});

test('unpkg registration entry point works without a class import', async ({
	page,
}) => {
	await page.route('https://unpkg.com/**/define.js*', (route) =>
		route.fulfill({ path: 'define.js', contentType: 'text/javascript' }),
	);
	await page.route('https://unpkg.com/**/img-alt-overlay.js*', (route) =>
		route.fulfill({
			path: 'img-alt-overlay.js',
			contentType: 'text/javascript',
		}),
	);
	await page.goto('/demo/unpkg.html');
	await page.getByRole('button', { name: 'View alt text' }).click();
	await expect(
		page.getByRole('dialog', { name: 'Image description' }),
	).toBeVisible();
});
