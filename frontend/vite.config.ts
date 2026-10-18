import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const envDir = process.cwd();
  const env = loadEnv(mode, envDir, '');
  // The tracked theme file supplies the public brand colors. Normal Vite env
  // files and deployment environment variables explicitly override them.
  const theme = { ...loadEnv('theme', envDir, 'VITE_THEME_'), ...env };
  for (const key of [
    'VITE_THEME_PRIMARY',
    'VITE_THEME_BACKGROUND',
    'VITE_THEME_COMMUNITY_PRIMARY',
    'VITE_THEME_COMMUNITY_BACKGROUND',
  ] as const) {
    if (!/^#[0-9a-f]{6}$/i.test(theme[key] ?? '')) {
      throw new Error(
        `${key} must be a quoted six-digit hex color, such as "#1D46E8". Set it in frontend/.env.theme or the environment.`,
      );
    }
  }
  const themePlugin: Plugin = {
    name: 'app-theme',
    configureServer(server) {
      const themeFiles = new Set([
        resolve(envDir, '.env.theme'),
        resolve(envDir, '.env.theme.local'),
      ]);
      server.watcher.add([...themeFiles]);
      server.watcher.on('all', (event, file) => {
        if (themeFiles.has(resolve(file)) && ['add', 'change', 'unlink'].includes(event)) {
          void server.restart();
        }
      });
    },
    transformIndexHtml() {
      return [
        {
          tag: 'style',
          attrs: { id: 'app-theme' },
          children: `:root{--theme-primary:${theme.VITE_THEME_PRIMARY};--theme-background:${theme.VITE_THEME_BACKGROUND};--theme-community-primary:${theme.VITE_THEME_COMMUNITY_PRIMARY};--theme-community-background:${theme.VITE_THEME_COMMUNITY_BACKGROUND}}`,
          injectTo: 'head-prepend',
        },
      ];
    },
  };

  return {
    plugins: [react(), themePlugin],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: false },
      },
    },
  };
});
