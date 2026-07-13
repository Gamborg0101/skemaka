import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import { getMessages } from "@skemaka/i18n"
import type { Locale, Messages } from "@skemaka/i18n"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers"
import { RegisterSW } from "@/components/pwa/RegisterSW"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Skemaka",
  description: "Staff scheduling, simplified.",
  applicationName: "Skemaka",
  appleWebApp: {
    capable: true,
    title: "Skemaka",
    // "default" = dark status-bar text, readable over the app's light background.
    statusBarStyle: "default",
  },
  // Legacy iOS tag for older versions to honour standalone (full-screen) mode.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  themeColor: "#0F172A",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  // The emails/sms namespaces are rendered exclusively on the server
  // (lib/resend.ts, lib/sms.ts, push payloads) — keep them out of the message
  // bundle serialized into every page for client components.
  const { emails: _emails, sms: _sms, ...rest } = getMessages(locale as Locale)
  // Cast: the provider's prop is typed as the full catalog, but a client-side
  // t("emails.…")/t("sms.…") has no call site by design (server-only namespaces).
  const clientMessages = rest as unknown as Messages
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <NextIntlClientProvider messages={clientMessages}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </NextIntlClientProvider>
        <RegisterSW />
      </body>
    </html>
  )
}
