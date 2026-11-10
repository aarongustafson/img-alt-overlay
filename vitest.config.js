import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		globals: true,
		exclude: ['**/node_modules/**', 'test/browser/**'],
		setupFiles: ['./test/setup.js'],
	},
});
