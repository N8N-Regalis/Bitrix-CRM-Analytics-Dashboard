// Bitrix deal custom fields the dashboard reads through a refresh script rather
// than from the `deals` table.
//
// Plain constants with no imports, so a Node script can load this file directly
// -- dealMeta.js pulls in the browser-side registries and can't be run that way.
// Same arrangement as clientFields.js for contacts.

/** "Reason for Axed" -- an enumeration on the deal. */
export const AXED_REASON_FIELD = 'UF_CRM_1755636401';

/** The enumeration option for an axe the system applied because the partner went
 * quiet. The label is carried alongside the id so the refresh script can refuse
 * to run if Bitrix has renumbered the options and 881 now means something else. */
export const AUTO_AXED_REASON_ID = '881';
export const AUTO_AXED_REASON_LABEL = 'Auto-axed - Partner did not respond for 1 week';
