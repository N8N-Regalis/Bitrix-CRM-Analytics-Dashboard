import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { isAllowedBitrixMethod } from './src/utils/bitrixMethods.js';

// The Bitrix webhook URL contains a secret path segment and grants CRM write
// access, so it must never reach the browser. In dev, this proxy terminates
// `/api/bitrix/<method>` here in the Vite server process (which runs in Node
// and can read the un-prefixed .env var) and forwards it with the secret path
// attached. Production does the same via netlify/functions/bitrix.mjs.
function bitrixProxy(webhookBase) {
  if (!webhookBase) return undefined;

  const { origin, pathname } = new URL(webhookBase);

  return {
    '/api/bitrix': {
      target: origin,
      changeOrigin: true,
      // Refuse anything outside the read-only allowlist, so the dev proxy is
      // no more permissive than the deployed one.
      bypass(req, res) {
        const method = req.url.replace(/^\/api\/bitrix\//, '').split('?')[0];
        if (req.method !== 'GET' || !isAllowedBitrixMethod(method)) {
          res.statusCode = 403;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'method_not_allowed', error_description: method }));
          return true; // handled; don't proxy
        }
        return null;
      },
      rewrite: (urlPath) => urlPath.replace(/^\/api\/bitrix/, pathname.replace(/\/$/, '')),
    },
  };
}

export default defineConfig(({ mode }) => {
  // '' prefix loads every var, not just VITE_-prefixed ones. Values read here
  // stay in the Node process; only what's referenced in client code is inlined
  // into the bundle, and BITRIX_WEBHOOK_BASE never is.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: bitrixProxy(env.BITRIX_WEBHOOK_BASE),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-charts': ['recharts'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-supabase': ['@supabase/supabase-js'],
          },
        },
      },
    },
  };
});
