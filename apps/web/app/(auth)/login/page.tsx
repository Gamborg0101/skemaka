import Link from "next/link";
import { signIn } from "@/lib/auth";
import { Calendar, DollarSign, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getISOWeek, getMondayOfWeek } from "@/lib/dateUtils";

// Names come from the marketing.preview catalog so each locale sees local names.
const PREVIEW_SHIFTS = [
  {
    nameKey: "nameHeadChef" as const,
    roleKey: "roleHeadChef" as const,
    start: 14,
    end: 22,
    color: "bg-amber-400",
  },
  {
    nameKey: "nameSousChef" as const,
    roleKey: "roleSousChef" as const,
    start: 15,
    end: 22,
    color: "bg-amber-400",
  },
  {
    nameKey: "nameBartender" as const,
    roleKey: "roleBartender" as const,
    start: 16,
    end: 22,
    color: "bg-purple-400",
  },
  {
    nameKey: "nameWaiter1" as const,
    roleKey: "roleWaiter" as const,
    start: 16,
    end: 22,
    color: "bg-blue-400",
  },
];

const DAY_START = 6;
const DAY_END = 22;
const DAY_SPAN = DAY_END - DAY_START;

async function ShiftPreview({ weekNum }: { weekNum: number }) {
  const t = await getTranslations("auth.login");
  const tRoles = await getTranslations("marketing.preview");
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[11px] font-medium text-white/40 uppercase tracking-widest">
          {t("previewWeek", { week: weekNum })}
        </span>
      </div>
      <div className="space-y-3">
        {PREVIEW_SHIFTS.map((s) => {
          const offsetPct = ((s.start - DAY_START) / DAY_SPAN) * 100;
          const widthPct = ((s.end - s.start) / DAY_SPAN) * 100;
          return (
            <div key={s.nameKey} className="flex items-center gap-3">
              <div className="w-20 shrink-0">
                <p className="text-[12px] font-medium text-white/75 truncate">
                  {tRoles(s.nameKey)}
                </p>
                <p className="text-[10px] text-white/30">{tRoles(s.roleKey)}</p>
              </div>
              <div className="relative flex-1 h-5">
                <div
                  className={`absolute h-full rounded-md ${s.color} opacity-75`}
                  style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
                />
              </div>
              <span className="text-[10px] text-white/25 w-16 text-right tabular-nums">
                {s.start}:00–{s.end}:00
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-[9px] text-white/15 tabular-nums">
        {["06", "09", "12", "15", "18", "21"].map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const t = await getTranslations("auth.login");
  const tCommon = await getTranslations("common");
  const weekNum = getISOWeek(getMondayOfWeek(new Date()));
  const features = [
    { icon: Calendar, title: t("feature1Title"), description: t("feature1Text") },
    { icon: DollarSign, title: t("feature2Title"), description: t("feature2Text") },
    { icon: Clock, title: t("feature3Title"), description: t("feature3Text") },
  ];
  // Use only the path+search so NextAuth's origin check always passes —
  // the full URL may use a LAN IP that doesn't match NEXTAUTH_URL.
  let redirectTo = "/onboarding";
  if (callbackUrl) {
    try {
      const u = new URL(callbackUrl);
      redirectTo = u.pathname + u.search;
    } catch {
      redirectTo = callbackUrl;
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[58%] bg-slate-900 flex-col p-12 relative overflow-hidden">
        {/* Subtle dot grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Soft glow */}
        <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-20 size-96 rounded-full bg-indigo-600/10 blur-3xl" />

        {/* Logo */}
        <div className="relative">
          <span className="text-lg font-bold text-white tracking-tight">
            Skemaka
          </span>
        </div>

        {/* Main content */}
        <div className="relative flex-1 flex flex-col justify-center gap-8">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
              {t("heroTitle1")}
              <br />
              {t("heroTitle2")}
            </h2>
            <p className="mt-3 text-slate-400 text-base leading-relaxed">
              {t("heroSub")}
            </p>
          </div>

          <ShiftPreview weekNum={weekNum} />
        </div>

        {/* Feature bullets */}
        <div className="relative grid grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="space-y-2">
              <div className="size-8 rounded-lg bg-white/8 flex items-center justify-center">
                <Icon className="size-4 text-white/50" />
              </div>
              <p className="text-xs font-medium text-white/60">{title}</p>
              <p className="text-[11px] text-white/30 leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 px-8 overflow-y-auto">
        <div className="w-full max-w-sm mx-auto space-y-8 py-12 my-auto">
          {/* Mobile-only logo */}
          <div className="text-center lg:hidden">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              Skemaka
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("tagline")}
            </p>
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {t("welcome")}
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              {t("welcomeSub")}
            </p>
          </div>

          <div className="space-y-4">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo });
              }}
            >
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <GoogleIcon />
                {t("google")}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400 dark:text-gray-600">
                {tCommon("or")}
              </span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Email magic link — the path invited staff use (no Google needed) */}
            <form
              action={async (formData: FormData) => {
                "use server";
                const email = String(formData.get("email") ?? "").trim();
                if (!email) return;
                await signIn("resend", { email, redirectTo });
              }}
              className="space-y-2.5"
            >
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                className="w-full h-11 px-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-colors"
              />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white shadow-sm transition-colors"
              >
                {t("emailButton")}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            {t.rich("agree", {
              terms: (chunks) => (
                <Link
                  href="/terms"
                  className="underline underline-offset-2 hover:text-gray-600 transition-colors"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/privacy"
                  className="underline underline-offset-2 hover:text-gray-600 transition-colors"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
