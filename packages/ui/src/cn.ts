import type { ClassValue } from "clsx"

// Lazy import so web (which has clsx) and mobile can both use this without
// bundling clsx for platforms that don't need it.
export function cn(...inputs: ClassValue[]): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { clsx } = require("clsx") as typeof import("clsx")
  return clsx(inputs)
}
