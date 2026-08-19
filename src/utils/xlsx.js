import { strToU8, zipSync } from 'fflate';

/**
 * Minimal multi-sheet .xlsx writer.
 *
 * An .xlsx file is a zip of XML parts, and a data export needs very few of
 * them: one worksheet per dataset, a bold frozen header row, and cells written
 * as numbers, booleans or inline strings. That is what this does -- no reader,
 * no formulas, no number formats -- which is why it is a few hundred lines
 * rather than a several-hundred-kilobyte dependency on the critical path of a
 * dashboard. fflate supplies the deflate/zip.
 *
 * A sheet is `{ name, columns: [{ key, header }], rows: [object] }`, and each
 * cell is `row[column.key]`.
 */

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// cellXfs index 1 in the stylesheet below; 0 is the default format.
const HEADER_STYLE = 1;

// Excel refuses to open a file whose cell text exceeds this, and rejects every
// control character except tab, newline and carriage return -- the gaps in the
// range below. Both are handled before the text is escaped.
const MAX_CELL_TEXT = 32767;
// eslint-disable-next-line no-control-regex -- matching them is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Zero-based column index to its spreadsheet letter (0 -> A, 26 -> AA). */
function columnLetter(index) {
  let letters = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
  }
  return letters;
}

function escapeXml(value) {
  return String(value)
    .replace(CONTROL_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * One `<c>` element, typed by what the value actually is: a finite number is
 * written as a number so Excel can sum it, a boolean as TRUE/FALSE, and
 * everything else as inline text. Empty and missing values produce no element
 * at all, which is how a blank cell is represented.
 *
 * Inline strings rather than a shared string table: the table would have to be
 * built and held in full before any sheet could be written, and deflate already
 * collapses the repetition it would have saved.
 */
function cellXml(ref, value, styleId) {
  if (value === null || value === undefined || value === '') return '';

  const style = styleId ? ` s="${styleId}"` : '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return `<c r="${ref}"${style} t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  const text = value instanceof Date ? value.toISOString() : String(value);
  const escaped = escapeXml(text.slice(0, MAX_CELL_TEXT));
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escaped}</t></is></c>`;
}

// Widths are estimated from a sample rather than the whole column: an export
// can run to six figures of rows, and the widest of the first couple of hundred
// is close enough for a column that the reader can drag anyway.
const WIDTH_SAMPLE = 200;
const MIN_WIDTH = 10;
const MAX_WIDTH = 48;

function columnWidths(columns, rows) {
  const sample = rows.slice(0, WIDTH_SAMPLE);
  return columns.map((column) => {
    let longest = String(column.header ?? column.key).length;
    for (const row of sample) {
      const value = row[column.key];
      if (value === null || value === undefined) continue;
      const length = String(value).length;
      if (length > longest) longest = length;
    }
    return Math.min(Math.max(longest + 2, MIN_WIDTH), MAX_WIDTH);
  });
}

function worksheetXml(columns, rows) {
  if (columns.length === 0) {
    return `${XML_DECLARATION}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`;
  }

  const lastColumn = columnLetter(columns.length - 1);
  const lastRow = rows.length + 1;
  const widths = columnWidths(columns, rows);
  const letters = columns.map((_, index) => columnLetter(index));

  // Element order inside <worksheet> is fixed by the schema: dimension,
  // sheetViews, sheetFormatPr, cols, sheetData, then autoFilter.
  const parts = [
    XML_DECLARATION,
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<dimension ref="A1:${lastColumn}${lastRow}"/>`,
    '<sheetViews><sheetView workbookViewId="0">',
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    '</sheetView></sheetViews>',
    '<sheetFormatPr defaultRowHeight="15"/>',
    '<cols>',
    widths
      .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
      .join(''),
    '</cols>',
    '<sheetData>',
    `<row r="1">${columns
      .map((column, index) => cellXml(`${letters[index]}1`, column.header ?? column.key, HEADER_STYLE))
      .join('')}</row>`,
  ];

  // Built one row string at a time and joined once at the end, so a large
  // export does not repeatedly copy a growing multi-megabyte string.
  rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    let cells = '';
    for (let index = 0; index < columns.length; index += 1) {
      cells += cellXml(`${letters[index]}${rowNumber}`, row[columns[index].key]);
    }
    parts.push(`<row r="${rowNumber}">${cells}</row>`);
  });

  parts.push('</sheetData>', `<autoFilter ref="A1:${lastColumn}${lastRow}"/>`, '</worksheet>');
  return parts.join('');
}

// Excel rejects these characters in a tab name, caps it at 31 characters, and
// will not open a workbook with two tabs sharing a name.
const INVALID_SHEET_CHARS = /[\\/?*[\]:]/g;

function sheetNames(sheets) {
  const taken = new Set();
  return sheets.map((sheet, index) => {
    const fallback = `Sheet${index + 1}`;
    const base =
      String(sheet.name ?? '')
        .replace(INVALID_SHEET_CHARS, ' ')
        .trim()
        .slice(0, 31) || fallback;

    let name = base;
    for (let suffix = 2; taken.has(name.toLowerCase()); suffix += 1) {
      const tail = ` (${suffix})`;
      name = base.slice(0, 31 - tail.length) + tail;
    }
    taken.add(name.toLowerCase());
    return name;
  });
}

// Two fonts (default, bold) and the two fills Excel requires every stylesheet
// to declare, wired into two cellXfs: index 0 default, index 1 bold header.
const STYLES_XML = `${XML_DECLARATION}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>\
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>\
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>\
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>\
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>\
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>\
</styleSheet>`;

const ROOT_RELS_XML = `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\
</Relationships>`;

function contentTypesXml(sheetCount) {
  const overrides = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');

  return `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\
<Default Extension="xml" ContentType="application/xml"/>\
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\
${overrides}\
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>\
</Types>`;
}

function workbookXml(names) {
  const sheets = names
    .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('');

  return `${XML_DECLARATION}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" \
xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\
<sheets>${sheets}</sheets></workbook>`;
}

function workbookRelsXml(sheetCount) {
  const sheetRels = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join('');

  return `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\
${sheetRels}\
<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\
</Relationships>`;
}

/** Builds the workbook as raw bytes, ready to wrap in a Blob. */
export function buildXlsx(sheets) {
  const names = sheetNames(sheets);

  const files = {
    '[Content_Types].xml': strToU8(contentTypesXml(sheets.length)),
    '_rels/.rels': strToU8(ROOT_RELS_XML),
    'xl/workbook.xml': strToU8(workbookXml(names)),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRelsXml(sheets.length)),
    'xl/styles.xml': strToU8(STYLES_XML),
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(
      worksheetXml(sheet.columns ?? [], sheet.rows ?? [])
    );
  });

  return zipSync(files, { level: 6 });
}
