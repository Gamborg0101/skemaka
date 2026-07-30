import { CookieSettingsLink } from "@/components/CookieBanner"

export const metadata = {
  title: "Cookie Policy – Skemaka",
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3 text-gray-600 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

const COOKIES = [
  {
    name: "authjs.session-token",
    purpose: "Keeps you signed in.",
    category: "Necessary",
    lifetime: "30 minutes (rolling)",
  },
  {
    name: "authjs.csrf-token / authjs.callback-url",
    purpose: "Protects sign-in against cross-site request forgery.",
    category: "Necessary",
    lifetime: "Session",
  },
  {
    name: "skemaka_cookie_consent",
    purpose: "Remembers the cookie choices you make in the banner.",
    category: "Necessary",
    lifetime: "12 months",
  },
  {
    name: "NEXT_LOCALE",
    purpose: "Remembers the language you picked (Danish/English).",
    category: "Preferences",
    lifetime: "12 months",
  },
  {
    name: "skemaka_act_as",
    purpose: "Lets Skemaka support staff assist a specific restaurant. Only ever set for Skemaka personnel.",
    category: "Necessary",
    lifetime: "Session",
  },
]

export default function CookiePolicyPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
      <p className="text-sm text-gray-400 mb-12">Last updated: 17 July 2026</p>

      <Section title="1. What Cookies Are">
        <p>
          Cookies are small text files a website stores in your browser. Skemaka uses them for one
          thing: making the product work — signing you in, keeping your session secure, and
          remembering choices like your language.
        </p>
        <p>
          <strong>We do not use advertising, marketing, or analytics cookies, and we do not load any
          third-party tracking scripts.</strong> If that ever changes, such cookies will stay off
          until you explicitly allow them in the cookie settings.
        </p>
      </Section>

      <Section title="2. The Cookies We Set">
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-3 py-2 font-semibold">Cookie</th>
                <th className="px-3 py-2 font-semibold">Purpose</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Lifetime</th>
              </tr>
            </thead>
            <tbody>
              {COOKIES.map((c) => (
                <tr key={c.name} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2 font-mono text-xs text-gray-800 whitespace-nowrap">{c.name}</td>
                  <td className="px-3 py-2 text-gray-600">{c.purpose}</td>
                  <td className="px-3 py-2 text-gray-600">{c.category}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.lifetime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          Necessary cookies are exempt from consent under the Danish cookie rules and the ePrivacy
          Directive because the service you request cannot function without them. The preference
          cookie is only set when you actively choose a language.
        </p>
      </Section>

      <Section title="3. Third Parties">
        <p>
          Payments are handled by Stripe on Stripe&rsquo;s own pages; any cookies Stripe sets there are
          governed by{" "}
          <a href="https://stripe.com/privacy" className="text-blue-600 hover:underline" rel="noreferrer" target="_blank">
            Stripe&rsquo;s privacy policy
          </a>
          . Skemaka pages themselves load no third-party scripts, fonts, or pixels that set cookies.
        </p>
      </Section>

      <Section title="4. Managing Your Choices">
        <p>
          You can change your cookie choices at any time via{" "}
          <CookieSettingsLink className="text-blue-600 hover:underline" />
          {" "}— also linked in the footer of every page. Your consent is stored for 12 months, after
          which we ask again. You can also delete cookies in your browser settings at any time;
          deleting the session cookie simply signs you out.
        </p>
      </Section>

      <Section title="5. Contact">
        <p>
          Questions about cookies or privacy? Write to{" "}
          <a href="mailto:privacy@skemaka.com" className="text-blue-600 hover:underline">
            privacy@skemaka.com
          </a>
          . For how we handle personal data more broadly, see our Privacy Policy.
        </p>
      </Section>
    </article>
  )
}
