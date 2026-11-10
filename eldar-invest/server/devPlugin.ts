/** Serves the /api handlers from `vite dev` and `vite preview`, so one command runs the whole app locally. */
import type { Connect, Plugin } from 'vite';
import { loadEnv } from 'vite';
import { aiHandler } from './gemini.js';
import type { Handler } from './http.js';
import { marketHandler } from './market.js';
import { statusHandler } from './status.js';

const routes: Record<string, Handler> = { '/api/ai': aiHandler, '/api/market': marketHandler, '/api/status': statusHandler };

export function apiPlugin(): Plugin {
  const mount = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      const handler = routes[(req.url ?? '').split('?')[0]];
      if (!handler) return next();
      void handler(req, res);
    });
  };
  return {
    name: 'eldar-api',
    config(_c, { mode }) {
      // Server-only variables (no VITE_ prefix) from .env files; never exposed to the browser bundle.
      const fileEnv = loadEnv(mode, process.cwd(), '');
      for (const [k, v] of Object.entries(fileEnv)) if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v;
    },
    configureServer: (s) => mount(s.middlewares),
    configurePreviewServer: (s) => mount(s.middlewares),
  };
}
