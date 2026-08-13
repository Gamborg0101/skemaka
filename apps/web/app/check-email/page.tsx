import Link from "next/link"
import { Mail } from "lucide-react"
import { getTranslations } from "next-intl/server"

/**
 * Shown after requesting a magic link.
 *
 * NextAuth's stock verify-request page is an unstyled English "Check your
 * email", which lands mid-flow on someone who has just read a Danish login
 * screen — the only untranslated step in an otherwise localized sign-in.
 * Wired up via `pages.verifyRequest` in auth.config.ts.
 */
export default async function CheckEmailPage() {
  const t = await getTranslations("auth.checkEmail")

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-2xl font-bold text-gray-900 tracking-tight">Skemaka</div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-blue-50">
          <Mail className="size-6 text-blue-600" />
        </div>

        <h1 className="text-lg font-semibold text-gray-900 mb-1">{t("title")}</h1>
        <p className="text-sm text-gray-500">{t("body")}</p>

        {/* The link is single-use, and mail clients that pre-scan links can
            burn it before the recipient clicks. Say so, and make requesting
            another one one click away rather than a dead end. */}
        <p className="mt-4 text-xs text-gray-400">{t("hint")}</p>

        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-700 underline underline-offset-2"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  )
}
