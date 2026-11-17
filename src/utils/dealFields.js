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

/** The automation also axes deals under the generic "Other - Internal" reason and
 * explains itself in "Other Reason (Please Specify)" (a multi-value text field).
 * "Other - Internal" is also used for offboarded clients, duplicates and so on, so
 * a deal only counts as auto-axed when that text is the automation's message:
 * "Automatically Axed by Automation. Client failed to respond on the Automated
 * follow-up for XX Days." -- XX varies. As with option 881, the label is carried
 * so the refresh script can refuse to run if 993 has been renumbered. */
export const OTHER_INTERNAL_REASON_ID = '993';
export const OTHER_INTERNAL_REASON_LABEL = 'Other - Internal';
export const OTHER_REASON_TEXT_FIELD = 'UF_CRM_1756304146842';
export const AUTOMATION_AXED_TEXT =
  /^\s*Automatically Axed by Automation\.\s*Client failed to respond on the Automated follow-up for \d+\s*Days?\b/i;
