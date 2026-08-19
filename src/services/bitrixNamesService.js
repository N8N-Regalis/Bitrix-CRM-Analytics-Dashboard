import { bitrixList } from '@/services/bitrixClient';
import { fetchBitrixUserList, bitrixUserName } from '@/services/bitrixUsersService';
import { CLIENT_STATUS_FIELD, CLIENT_STATUS_LOOKUP } from '@/utils/clientFields';
import { cleanName } from '@/utils/nameMatch';
import {
  registerAssociateNames,
  registerClientNames,
  registerClientStatuses,
} from '@/utils/nameRegistry';

/**
 * Refreshes the associate and client name overlays from Bitrix once per app
 * load, so a person added since the last build resolves to a real name instead
 * of "Associate #359" / "Client #673".
 *
 * Awaited by every fetch that resolves those labels (dealService,
 * presentedDealsService), which is what guarantees the overlay is populated
 * before any row is normalized. Failures are swallowed on purpose: the
 * build-time snapshots in associateNames.js / clientNames.js remain as the
 * fallback, so Bitrix being unreachable degrades name freshness rather than
 * breaking the dashboard.
 */

let pending = null;

export function ensureLiveNames() {
  if (!pending) pending = loadLiveNames();
  return pending;
}

async function loadLiveNames() {
  const results = await Promise.allSettled([loadAssociates(), loadClients()]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('Live name refresh failed; using build-time snapshot.', result.reason);
    }
  }
}

async function loadAssociates() {
  const users = await fetchBitrixUserList();
  registerAssociateNames(users.map((user) => [user.ID, bitrixUserName(user)]));
}

async function loadClients() {
  const contacts = await bitrixList('crm.contact.list', {
    'select[]': ['ID', 'NAME', 'LAST_NAME', CLIENT_STATUS_FIELD],
  });

  registerClientNames(
    contacts.map((contact) => [contact.ID, cleanName(`${contact.NAME || ''} ${contact.LAST_NAME || ''}`)])
  );

  registerClientStatuses(
    contacts.map((contact) => [contact.ID, CLIENT_STATUS_LOOKUP[String(contact[CLIENT_STATUS_FIELD])]])
  );
}
