import Link from "next/link"

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link href="/login" className="text-base font-bold text-gray-900 hover:text-gray-700 transition-colors">
            Skemaka
          </Link>
          <Link
            href="/login"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        {children}
      </main>
      <footer className="border-t border-gray-100 mt-24">
        <div className="mx-auto max-w-3xl px-6 py-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400">
          <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
          <Link href="/cookies" className="hover:text-gray-600 transition-colors">Cookie Policy</Link>
          <Link href="/subprocessors" className="hover:text-gray-600 transition-colors">Sub-processors</Link>
          <Link href="/support" className="hover:text-gray-600 transition-colors">Support</Link>
        </div>
      </footer>
    </div>
  )
}
