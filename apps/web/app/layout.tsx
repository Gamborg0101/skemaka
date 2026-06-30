import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono } from "next/font/google"
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Providers>
          {children}
          <Toaster />
        </Providers>
        <RegisterSW />
      </body>
    </html>
  )
}
