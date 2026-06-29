export const metadata = {
  title: "Sub-processors – Skemaka",
}

type Subprocessor = {
  name: string
  purpose: string
  location: string
  href: string
}

// Kept in sync with Section 5 of the Privacy Policy. When you add, remove, or
// change a sub-processor here, update /privacy and notify customers per the DPA.
const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Neon",
    purpose: "PostgreSQL database hosting (primary data store)",
    location: "EU — Frankfurt (eu-central-1)",
    href: "https://neon.tech/privacy-policy",
  },
  {
    name: "Vercel",
    purpose: "Application hosting, edge delivery, and logging",
    location: "EU / Global edge",
    href: "https://vercel.com/legal/privacy-policy",
  },
  {
    name: "Stripe",
    purpose: "Subscription billing and payment processing",
    location: "EU / US (SCCs)",
    href: "https://stripe.com/privacy",
  },
  {
    name: "Google",
    purpose: "Sign-in (Google OAuth) authentication",
    location: "EU / US (SCCs)",
    href: "https://policies.google.com/privacy",
  },
  {
    name: "Resend",
    purpose: "Transactional email delivery (invites, notices)",
    location: "EU / US (SCCs)",
    href: "https://resend.com/legal/privacy-policy",
  },
  {
    name: "Twilio",
    purpose: "SMS notifications (schedule and availability alerts)",
    location: "EU / US (SCCs)",
    href: "https://www.twilio.com/en-us/legal/privacy",
  },
  {
    name: "Upstash",
    purpose: "Rate limiting (Redis); no personal data stored",
    location: "EU / Global",
    href: "https://upstash.com/trust/privacy.pdf",
  },
]

export default function SubprocessorsPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Sub-processors</h1>
      <p className="text-sm text-gray-400 mb-12">Last updated: 28 June 2026</p>

      <section className="mb-10">
        <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
          <p>
            Skemaka engages the third-party service providers below to operate the Service. Each
            processes personal data only on our instructions and under a data processing agreement
            with appropriate security and transfer safeguards. This list complements Section 5 of our{" "}
            <a href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </section>

      <section className="mb-10 overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead>
            <tr className="border-b border-gray-200 text-gray-900">
              <th className="py-2 pr-4 font-semibold">Sub-processor</th>
              <th className="py-2 pr-4 font-semibold">Purpose</th>
              <th className="py-2 font-semibold">Data location</th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((sp) => (
              <tr key={sp.name} className="border-b border-gray-100 align-top">
                <td className="py-3 pr-4 font-medium text-gray-900">
                  <a href={sp.href} className="text-blue-600 hover:underline" target="_blank" rel="noopener">
                    {sp.name}
                  </a>
                </td>
                <td className="py-3 pr-4">{sp.purpose}</td>
                <td className="py-3">{sp.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Changes &amp; notice</h2>
        <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
          <p>
            We will give customers advance notice of any new sub-processor so you may object before it
            begins processing. Questions or a copy of our Data Processing Agreement can be requested at{" "}
            <a href="mailto:privacy@skemaka.com" className="text-blue-600 hover:underline">
              privacy@skemaka.com
            </a>
            .
          </p>
        </div>
      </section>
    </article>
  )
}
