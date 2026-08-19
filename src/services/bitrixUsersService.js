// Resolves Bitrix user emails to display names, for the submissions data whose
// only associate identifier is an email address.
//
// Goes through the /api/bitrix proxy (see bitrixClient.js) -- the webhook
// secret is never in the client bundle.

import { bitrixList } from '@/services/bitrixClient';
import { cleanName } from '@/utils/nameMatch';

// Memoized for the lifetime of the page: two consumers need this list (the
// email->name map below, and the id->name overlay in bitrixNamesService), and
// it's ~4 paginated requests. One fetch per app load serves both.
let userListPromise = null;

// user.get is deliberately unfiltered: an ACTIVE query param is ignored by
// this endpoint (both values return the same subset), and deactivated staff
// still own historical deals. See scripts/refresh-associate-names.mjs.
export function fetchBitrixUserList() {
  if (!userListPromise) {
    userListPromise = bitrixList('user.get').catch((error) => {
      userListPromise = null; // let a later caller retry
      throw error;
    });
  }
  return userListPromise;
}

export function bitrixUserName(user) {
  const full = cleanName(`${user.NAME || ''} ${user.LAST_NAME || ''}`);
  return full || user.LOGIN || cleanName(user.EMAIL) || '';
}

/** email -> display name. */
export async function fetchBitrixUsers() {
  try {
    const users = await fetchBitrixUserList();
    const emailToName = {};

    for (const user of users) {
      const email = (user.EMAIL || '').toLowerCase().trim();
      if (!email) continue;
      const name = bitrixUserName(user);
      if (name) emailToName[email] = name;
    }

    return emailToName;
  } catch (error) {
    console.error('Failed to fetch Bitrix users:', error);
    // Callers fall back to showing the raw email, which is still identifiable.
    return {};
  }
}

export async function getAssociateLabelByEmail(email) {
  if (!email) return 'Unknown';
  const normalized = email.toLowerCase().trim();
  const emailMap = await fetchBitrixUsers();
  return emailMap[normalized] || email;
}
