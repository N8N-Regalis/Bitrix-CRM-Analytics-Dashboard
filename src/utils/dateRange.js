// Turns the two date inputs into the range a report should actually query.
//
// The reference the figures are checked against -- the Deal Report app's
// submissions view -- filters on a single exact day (`source_date === picked`).
// Here the same pick used to leave the other bound open, so a From of 08/06
// kept counting today's rows too and read 40 sourced deals where the reference
// read 20. Mirroring the filled bound onto the empty one makes one pick mean
// one day, which is the comparison people actually run.
//
// Applied at query time rather than by writing into the empty input: an
// `<input type="date">` emits a value on every segment edit, so typing a year
// walks through 0002, 0020, 0202 before 2026, and a write-back captures the
// first of those. Nothing partial survives to here -- only committed state.

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// A half-typed year is still a structurally valid date -- typing 2026 emits
// 0002, 0020 and 0202 first -- so shape alone cannot tell a real bound from a
// keystroke in progress. Nothing in this data predates the Bitrix era by
// centuries, so a year under 1000 is always mid-typing, and treating it as
// no-bound-yet keeps the table steady until the year is fully entered.
const EARLIEST_PLAUSIBLE = '1000-01-01';

/** A bound is usable only once it is a complete, plausible yyyy-mm-dd. */
function bound(value) {
  if (!value || !FULL_DATE.test(value)) return null;
  return value >= EARLIEST_PLAUSIBLE ? value : null;
}

/**
 * Resolves the raw (from, to) filter state into the effective range.
 *
 * Both empty means unfiltered. Both set is the range as given. Exactly one set
 * means that single day. Clearing a bound therefore narrows to a day rather
 * than opening the range -- to query open-ended, clear both and sort instead.
 */
export function resolveDateRange(from, to) {
  const dateFrom = bound(from);
  const dateTo = bound(to);

  if (dateFrom && dateTo) return { dateFrom, dateTo };
  if (dateFrom) return { dateFrom, dateTo: dateFrom };
  if (dateTo) return { dateFrom: dateTo, dateTo };
  return { dateFrom: null, dateTo: null };
}

/** True when the resolved range covers exactly one day, so the UI can say so. */
export function isSingleDay(dateFrom, dateTo) {
  return Boolean(dateFrom) && dateFrom === dateTo;
}

/**
 * Tests a `yyyy-mm-dd` day against resolved bounds of the same shape, so the
 * comparison is a lexicographic string compare. Parsing the bounds into Date
 * objects instead would anchor them to midnight in one zone and quietly shift
 * which day a row falls on -- and, when the bound is the upper one, would put
 * every row later than midnight on that day outside the range.
 *
 * Pass bounds that have already been through resolveDateRange; raw input state
 * can still be half-typed.
 *
 * NOTE: useSubmissions.js carries an identical private copy that the presented
 * deals report has always used. This one was added for the deal-created filters
 * rather than reusing that one, to keep the reworked pages from touching the
 * report's code path. Collapse the two once these have run in production.
 */
export function inDateRange(day, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  if (!day) return false; // undated rows can't be placed in a range
  if (dateFrom && day < dateFrom) return false;
  if (dateTo && day > dateTo) return false;
  return true;
}

/**
 * The UTC calendar day a timestamp falls on, as `yyyy-mm-dd`.
 *
 * Timestamp columns (`created_at`) have to be reduced to a day before they can
 * be compared against the date inputs' bounds. The presented and stage-movement
 * reports read `date` columns that already arrive in this shape; this is what
 * puts deals on the same footing. Reducing via toISOString states the UTC basis
 * outright instead of depending on how PostgREST serializes the offset.
 */
export function toDayString(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats one bound for display, reading the parts straight off the string.
 * Routing it through Date would treat it as UTC midnight and render the day
 * before anywhere west of UTC, which is the whole class of bug this file
 * exists to avoid. */
export function formatDay(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

/** Label for the applied range; empty string when nothing is filtered. */
export function describeRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return '';
  if (isSingleDay(dateFrom, dateTo)) return formatDay(dateFrom);
  return `${formatDay(dateFrom)} – ${formatDay(dateTo)}`;
}
