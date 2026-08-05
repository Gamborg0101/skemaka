"use client"

import { useTranslations } from "next-intl"
import type { Translate } from "./serviceErrorMessages"

/**
 * `useTranslations("common")`, loosely typed as {@link Translate} so it can
 * be passed to `translateServiceError`. The cast lives here, in one place,
 * instead of `as unknown as Translate` at every call site — see Translate's
 * doc comment in `serviceErrorMessages.ts` for why the real next-intl
 * translator type can't be threaded through that helper directly.
 */
export function useServiceErrorTranslate(): Translate {
  const tCommon = useTranslations("common")
  return tCommon as unknown as Translate
}
