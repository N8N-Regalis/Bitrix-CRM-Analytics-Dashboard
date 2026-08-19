import { buildXlsx } from '@/utils/xlsx';

/**
 * Turning a sheet -- `{ name, columns: [{ key, header }], rows }` -- into a file
 * the browser downloads, as either a single multi-tab workbook or one CSV per
 * sheet. Both read the same sheet shape, so an export is defined once and can
 * be offered in either format.
 */

const NEEDS_QUOTES = /[",\r\n]/;

// Opening a CSV in a spreadsheet evaluates any cell whose text starts like a
// formula. These exports carry hand-typed partner names and listing URLs, so
// such a value is prefixed with an apostrophe to keep it inert text. A leading
// '-' is deliberately not guarded: negative numbers are legitimate data and
// far more common here than a cell that starts with a minus and is dangerous.
const FORMULA_START = /^[=+@\t\r]/;

function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv({ columns = [], rows = [] }) {
  const lines = [columns.map((column) => csvCell(column.header ?? column.key)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column.key])).join(','));
  }
  return lines.join('\r\n');
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking in the same tick cancels the download in some browsers, so the
  // object URL is released once the click has been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadCsv(filename, sheet) {
  // The byte order mark is what makes Excel read the file as UTF-8 rather than
  // the machine's local codepage, which otherwise mangles accented names.
  const blob = new Blob(['\uFEFF', toCsv(sheet)], { type: 'text/csv;charset=utf-8' });
  downloadBlob(filename, blob);
}

export function downloadXlsx(filename, sheets) {
  const blob = new Blob([buildXlsx(sheets)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(filename, blob);
}
