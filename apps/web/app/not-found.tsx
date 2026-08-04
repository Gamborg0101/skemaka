import Link from "next/link"
import { getTranslations } from "next-intl/server"

/**
 * The CTA points at "/" and not "/schedule".
 *
 * A 404 is overwhelmingly reached by a logged-OUT visitor — an old marketing
 * link, a typo, a shared URL. "/schedule" is auth-gated in proxy.ts, so the
 * only way off this page bounced them to /login?callbackUrl=/schedule: a
 * stranger who mistyped a URL was shown a sign-in wall. "/" is right for a
 * visitor and costs a signed-in manager one extra click.
 */
export default async function NotFound() {
  const t = await getTranslations("common")

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-5xl font-bold text-gray-300 dark:text-gray-700">404</p>
        <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("notFoundTitle")}
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("notFoundBody")}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {t("notFoundHome")}
        </Link>
      </div>
    </div>
  )
}
