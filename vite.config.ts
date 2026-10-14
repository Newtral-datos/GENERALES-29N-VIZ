import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Nombre del repo de GitHub (Newtral-datos/GENERALES-29N-VIZ) → ruta base
// de GitHub Pages: https://newtral-datos.github.io/GENERALES-29N-VIZ/
const REPO_BASE = '/GENERALES-29N-VIZ';

export default defineConfig(({ command }) => ({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: undefined,
				precompress: false,
				strict: true
			}),

			paths: {
				base: command === 'build' ? REPO_BASE : ''
			}
		})
	]
}));
