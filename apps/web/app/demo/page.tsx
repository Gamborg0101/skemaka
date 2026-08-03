import Link from "next/link"
import { Check } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { signIn } from "@/lib/auth"
import { SchedulePreview } from "@/components/marketing/SchedulePreview"
import { DemoLaunchButton } from "@/components/marketing/DemoLaunchButton"
import { LangQuerySync } from "@/components/marketing/LocaleToggle"

export async function generateMetadata() {
  const t = await getTranslations("marketing.demo")
  return {
    title: `${t("title")} — Skemaka`,
    description: t("sub"),
  }
}

/**
 * Launcher for the "try the live demo" flow: one click creates a private,
 * fully-seeded sandbox restaurant (see lib/demo/seedDemoOrg.ts) and signs the
 * visitor in as its manager via the public "demo" credentials provider.
 */
export default async function DemoPage() {
  const t = await getTranslations("marketing.demo")

  async function startDemo() {
    "use server"
    await signIn("demo", { redirectTo: "/schedule" })
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Honour ?lang= here too — the sandbox reads the NEXT_LOCALE cookie when
          it seeds, so a Danish campaign link that lands straight on /demo has to
          set the cookie before the visitor clicks, or they get an English
          restaurant from a Danish ad. */}
      <LangQuerySync />
      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-16 sm:px-6 lg:py-24">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700">
          <span className="size-1.5 animate-pulse rounded-full bg-green-500" />
          {t("badge")}
        </span>

        <h1 className="max-w-2xl text-center text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-2xl text-center text-lg leading-relaxed text-gray-600">
          {t("sub")}
        </p>

        <ul className="mt-8 space-y-2.5">
          {[t("point1"), t("point2"), t("point3")].map((point) => (
            <li key={point} className="flex items-center gap-2.5 text-gray-700">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Check className="size-3 text-green-600" />
              </span>
              {point}
            </li>
          ))}
        </ul>

        <form action={startDemo} className="mt-10 flex flex-col items-center gap-3">
          <DemoLaunchButton label={t("cta")} pendingLabel={t("launching")} />
          <p className="text-sm text-gray-400">{t("note")}</p>
        </form>

        <div className="mt-14 w-full max-w-2xl">
          <SchedulePreview />
        </div>

        <p className="mt-10 text-sm text-gray-500">
          {t("signupPrompt")}{" "}
          <Link href="/login" className="font-semibold text-blue-600 hover:underline">
            {t("signupLink")}
          </Link>
        </p>
      </div>
    </div>
  )
}
