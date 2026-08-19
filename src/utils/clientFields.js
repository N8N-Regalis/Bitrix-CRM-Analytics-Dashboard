// Bitrix24 CRM contact custom fields describing a client's relationship
// lifecycle (Setting Up -> Deal Flow -> ... -> Deal Closed/Lost), distinct
// from a deal's stage_id. Consumed by scripts/refresh-client-data.mjs (which
// resolves CLIENT_STATUS_FIELD codes into src/utils/clientStatus.js via
// CLIENT_STATUS_LOOKUP) and by getClientStatus() in dealMeta.js. Originally
// staged here from the reference app (Bitrix Dashboard App/src/utils/bitrix.js).
export const TEAM_FIELD = 'UF_USR_1779466932710';
export const TEAM_LEAD_FIELD = 'UF_CRM_1782826965894';
export const CLIENT_STATUS_FIELD = 'UF_CRM_1755185977882';
export const DEAL_FLOW_START_DATE_FIELD = 'UF_CRM_1755184781147';
export const ONBOARDING_CALL_DATE_FIELD = 'UF_CRM_1755183436825';
export const DATE_OFFBOARDED_FIELD = 'UF_CRM_1768858493789';
export const DATE_PAUSED_FIELD = 'UF_CRM_1769099686480';

export const CLIENT_STATUS_LOOKUP = {
  '65': 'Setting Up',
  '67': 'Deal Flow',
  '69': 'Post LOI',
  '71': 'Closing Stage',
  '73': 'Deal Closed',
  '75': 'Closed Lost',
  '77': 'Rescinded',
  '79': 'Terminated',
  '81': 'Paused',
};

// Client status is a "status" color job (state, reserved meaning), not
// series identity -- so each of the 9 lifecycle labels above maps onto the
// app's existing 4-level status palette (see StatusBadge.jsx) rather than
// getting its own hue. 'primary' covers every still-open, in-progress state
// (mirrors how deal status treats "Active"); good/critical/warning mark the
// terminal or attention-needing outcomes.
const CLIENT_STATUS_VARIANTS = {
  'Setting Up': 'primary',
  'Deal Flow': 'primary',
  'Post LOI': 'primary',
  'Closing Stage': 'primary',
  'Deal Closed': 'good',
  'Closed Lost': 'critical',
  Rescinded: 'critical',
  Terminated: 'critical',
  Paused: 'warning',
};

export function getClientStatusVariant(statusLabel) {
  return CLIENT_STATUS_VARIANTS[statusLabel] || 'muted';
}

// Funnel order for the client lifecycle, mirroring STAGE_ORDER in dealMeta.js:
// the in-progress states run in sequence, then off-funnel outcomes (Paused,
// and the three "left the funnel" statuses) are appended at the end for
// chart ordering. Used by getClientStatusDistribution() so the ordinal color
// ramp reads as "further along", not an arbitrary sort.
export const CLIENT_STATUS_ORDER = [
  'Setting Up',
  'Deal Flow',
  'Post LOI',
  'Closing Stage',
  'Deal Closed',
  'Paused',
  'Closed Lost',
  'Rescinded',
  'Terminated',
];

// "Offboarded" groups the three exit statuses that mean the client left the
// funnel without pausing. Kept as a named constant (not inlined at each call
// site) so the KPI card and any future filter/report stay in sync by
// construction.
export const OFFBOARDED_STATUSES = ['Closed Lost', 'Rescinded', 'Terminated'];
export const ACTIVE_CLIENT_STATUS = 'Deal Flow';
