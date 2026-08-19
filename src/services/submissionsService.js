import { createClient } from '@supabase/supabase-js';

const TABLE = 'submissions';
const PAGE_SIZE = 1000;

/** Shared so the header's freshness readout can observe and refresh this exact
 * query rather than starting a second copy of a 100k-row fetch. Lives here
 * rather than beside the hook so the header doesn't have to import the whole
 * Presented Deals aggregation just to name the key. */
export const SUBMISSIONS_QUERY_KEY = ['submissions'];

// Separate Supabase client for submissions table (React Deal Report App's instance)
const submissionsSupabase = createClient(
  'https://euagtbotutlygqtzwrvm.supabase.co',
  'sb_publishable_j8BesG66AZK3le2ZJfrjJA_Y-w95AY3'
);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTER_MAP = { 1: 'Q1', 2: 'Q1', 3: 'Q1', 4: 'Q2', 5: 'Q2', 6: 'Q2', 7: 'Q3', 8: 'Q3', 9: 'Q3', 10: 'Q4', 11: 'Q4', 12: 'Q4' };

function getWeekLabel(utcDateStr) {
  const d = new Date(utcDateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function enrichRowWithDates(row) {
  if (!row.timestamp) return row;
  const d = new Date(row.timestamp);
  const utcDateStr = d.toISOString().split('T')[0];
  const utcYear = parseInt(utcDateStr.split('-')[0]);
  const utcMonthNum = parseInt(utcDateStr.split('-')[1]);
  return {
    ...row,
    source_date: utcDateStr,
    year: utcYear,
    month: MONTHS[utcMonthNum - 1],
    month_num: utcMonthNum,
    quarter: QUARTER_MAP[utcMonthNum],
    week: getWeekLabel(utcDateStr),
    day: DAY_NAMES[d.getDay()],
    sourcer_email: (row.user_email || '').toLowerCase().trim(),
  };
}

export async function fetchAllSubmissions() {
  const rows = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await submissionsSupabase
      .from(TABLE)
      .select('*')
      .order('timestamp', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data.map(enrichRowWithDates));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
