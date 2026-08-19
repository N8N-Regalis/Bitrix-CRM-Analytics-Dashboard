// The only Bitrix REST methods the browser is allowed to reach through the
// /api/bitrix proxy.
//
// The webhook behind that proxy is scoped `crm, task, tasks, user,
// user.userfield, userfieldconfig` -- which includes CRM *writes*. The proxy
// exists so that secret never reaches the client bundle, but a proxy that
// forwards any method would just be the same hole with extra steps: anyone
// using the app could POST through it. So the proxy forwards these three
// read-only list methods and nothing else.
//
// Shared verbatim by the Vite dev proxy (vite.config.js) and the Netlify
// function (netlify/functions/bitrix.mjs) so dev and production can't drift.
export const ALLOWED_BITRIX_METHODS = ['user.get', 'crm.contact.list', 'crm.activity.list'];

/** Accepts the bare method or its `.json` form, e.g. `user.get` / `user.get.json`. */
export function isAllowedBitrixMethod(method) {
  return ALLOWED_BITRIX_METHODS.includes(String(method || '').replace(/\.json$/, ''));
}
