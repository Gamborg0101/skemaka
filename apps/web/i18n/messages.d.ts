import type { Messages } from "@skemaka/i18n"

declare module "next-intl" {
  interface AppConfig {
    Messages: Messages
  }
}
