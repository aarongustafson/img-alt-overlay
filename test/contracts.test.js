import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

describe('package contracts', () => {
	it('supports DOM-free imports and registers only through define.js', () => {
		const result = execFileSync(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				`
			import { ImgAltOverlayElement } from './index.js';
			import { defineImgAltOverlay } from './define.js';
			if (defineImgAltOverlay() !== false) throw new Error('Registered without DOM');
			try {
				new ImgAltOverlayElement();
				throw new Error('Constructed without DOM');
			} catch (error) {
				if (!error.message.includes('requires a browser DOM')) throw error;
			}
			console.log('ok');
		`,
			],
			{ encoding: 'utf8' },
		);
		expect(result.trim()).toBe('ok');
	});

	it('publishes the declared public files and keeps the optional stylesheet exported', () => {
		const packed = JSON.parse(
			execFileSync(
				'npm',
				['pack', '--dry-run', '--json', '--ignore-scripts'],
				{
					encoding: 'utf8',
				},
			),
		)[0];
		expect(packed.files.map((file) => file.path).sort()).toEqual(
			[...pkg.files, 'package.json'].sort(),
		);
		expect(pkg.exports['./img-alt-overlay.css']).toBe(
			'./img-alt-overlay.css',
		);
		expect(pkg.exports['./define.js'].types).toBe('./define.d.ts');
	});

	it('keeps manifest attributes, exports, and styling aligned', () => {
		const manifest = JSON.parse(
			readFileSync('custom-elements.json', 'utf8'),
		);
		const declaration = manifest.modules[0].declarations[0];
		expect(declaration.superclass.name).toBe('HTMLElement');
		expect(
			declaration.attributes.map((attribute) => attribute.name),
		).toEqual(['button-label', 'dialog-label', 'close-label']);
		expect(declaration.members.map((member) => member.name)).toEqual([
			'state',
			'refresh',
		]);
		expect(
			manifest.modules.find((module) => module.path === 'define.js')
				.exports,
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: 'custom-element-definition',
					name: 'img-alt-overlay',
				}),
			]),
		);
		const css = readFileSync('img-alt-overlay.css', 'utf8');
		for (const property of declaration.cssProperties)
			expect(css).toContain(property.name);
		expect(declaration.cssProperties).toContainEqual(
			expect.objectContaining({
				name: '--img-alt-dialog-min-block-size',
				default: '30%',
			}),
		);
		const sides = [
			'block-start',
			'block-end',
			'inline-start',
			'inline-end',
		];
		for (const [target, defaults] of [
			['button', ['0.5rem', 'auto', 'auto', '0.5rem']],
			['overlay', ['3.75rem', '0.5rem', '0.5rem', '0.5rem']],
		]) {
			for (const [index, side] of sides.entries()) {
				const name = `--img-alt-${target}-inset-${side}`;
				expect(declaration.cssProperties).toContainEqual(
					expect.objectContaining({ name, default: defaults[index] }),
				);
				expect(css).toContain(`var(${name}, ${defaults[index]})`);
			}
		}
	});
});

describe('starter publishing automation', () => {
	it('preserves release scripts, workflows, and versioned CDN imports', () => {
		expect(pkg.scripts.version).toBe(
			'node scripts/update-demo-versions.js && git add demo/esm.html',
		);
		expect(pkg.scripts.postversion).toBe('git push --follow-tags');
		expect(readFileSync('demo/esm.html', 'utf8')).toContain(
			`https://esm.sh/${pkg.name}@${pkg.version}/img-alt-overlay.js`,
		);
		const workflow = readFileSync('.github/workflows/publish.yml', 'utf8');
		expect(workflow).toContain('id-token: write');
		expect(workflow).toContain('npm publish --provenance --access public');
	});

	it('updates and stages the CDN demo and pushes a version commit/tag only to an isolated local remote', () => {
		const temporary = mkdtempSync(join(tmpdir(), 'img-alt-release-'));
		try {
			const root = join(temporary, 'component');
			mkdirSync(join(root, 'scripts'), { recursive: true });
			mkdirSync(join(root, 'demo'));
			copyFileSync(
				resolve('scripts/update-demo-versions.js'),
				join(root, 'scripts/update-demo-versions.js'),
			);
			writeFileSync(
				join(root, 'package.json'),
				JSON.stringify({
					name: pkg.name,
					version: '0.0.1',
					type: 'module',
					scripts: {
						version: pkg.scripts.version,
						postversion: pkg.scripts.postversion,
					},
				}),
			);
			copyFileSync(resolve('demo/esm.html'), join(root, 'demo/esm.html'));
			const git = (...args) =>
				execFileSync('git', args, {
					cwd: root,
					encoding: 'utf8',
					stdio: 'pipe',
				}).trim();
			git('init', '--initial-branch=main');
			git('config', 'user.name', 'Release test');
			git('config', 'user.email', 'release-test@example.invalid');
			git('config', 'commit.gpgsign', 'false');
			git('config', 'tag.gpgsign', 'false');
			const trailer =
				'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>';
			git('add', '.');
			git('commit', '-m', 'Initial fixture', '-m', trailer);
			git('init', '--bare', join(temporary, 'origin.git'));
			git('remote', 'add', 'origin', join(temporary, 'origin.git'));
			git('push', '--set-upstream', 'origin', 'main');
			execFileSync(
				'npm',
				[
					'version',
					'minor',
					'--sign-git-tag=false',
					'--message',
					`Release %s\n\n${trailer}`,
				],
				{
					cwd: root,
					stdio: 'pipe',
				},
			);
			expect(git('show', 'HEAD:demo/esm.html')).toContain(
				`${pkg.name}@0.1.0/img-alt-overlay.js`,
			);
			expect(git('status', '--porcelain')).toBe('');
			expect(
				git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0],
			).toBe(git('rev-parse', 'HEAD'));
			expect(
				git('ls-remote', 'origin', 'refs/tags/v0.1.0^{}').split(
					/\s/,
				)[0],
			).toBe(git('rev-parse', 'HEAD'));
		} finally {
			rmSync(temporary, { recursive: true, force: true });
		}
	});
});
