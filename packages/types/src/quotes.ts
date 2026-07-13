// Compatibility shim — quotes moved to @skemaka/i18n so they can be
// translated per locale. Existing imports from @skemaka/types keep working
// (default locale = English until callers pass a locale explicitly).
export { pickShiftQuote } from "@skemaka/i18n"
