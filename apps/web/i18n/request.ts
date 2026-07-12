import { getRequestConfig } from "next-intl/server"
import { getMessages } from "@skemaka/i18n"
import { resolveLocale } from "@/lib/locale"

export default getRequestConfig(async () => {
  const locale = await resolveLocale()
  return {
    locale,
    messages: getMessages(locale),
  }
})
