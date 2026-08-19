// Production counterpart to the Vite dev proxy in vite.config.js.
//
// Keeps BITRIX_WEBHOOK_BASE (a secret path granting CRM write access) on the
// server. The browser calls /api/bitrix/<method>?<params>; this attaches the
// webhook path and forwards. Set BITRIX_WEBHOOK_BASE in the Netlify site's
// environment variables -- it must NOT be VITE_-prefixed, or Vite would inline
// it into the client bundle and undo the whole point.

import { isAllowedBitrixMethod } from '../../src/utils/bitrixMethods.js';

export default async function handler(request) {
  const webhookBase = process.env.BITRIX_WEBHOOK_BASE;
  if (!webhookBase) {
    return json({ error: 'not_configured', error_description: 'BITRIX_WEBHOOK_BASE is not set' }, 500);
  }

  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed', error_description: 'GET only' }, 405);
  }

  const url = new URL(request.url);
  const method = url.pathname.replace(/^.*\/api\/bitrix\//, '').replace(/^.*\/bitrix\//, '');

  // Read-only allowlist; see bitrixMethods.js for why this matters.
  if (!isAllowedBitrixMethod(method)) {
    return json({ error: 'method_not_allowed', error_description: method }, 403);
  }

  const target = `${webhookBase.replace(/\/$/, '')}/${method}${url.search}`;
  const upstream = await fetch(target);
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      // Bitrix data changes slowly and every viewer gets the same answer, so
      // let the CDN absorb repeat loads instead of hitting Bitrix rate limits.
      'cache-control': 'public, max-age=300',
    },
  });
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const config = { path: '/api/bitrix/*' };
