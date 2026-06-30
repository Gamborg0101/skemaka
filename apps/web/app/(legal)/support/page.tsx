export const metadata = {
  title: "Support – Skemaka",
}

const SUPPORT_EMAIL = "gamborgc@gmail.com"

export default function SupportPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Support</h1>
      <p className="text-sm text-gray-400 mb-12">We&rsquo;re here to help.</p>

      <Section title="Contact us">
        <p>
          For help with the Skemaka app or your account, email us and we&rsquo;ll get back to you
          as soon as we can.
        </p>
        <p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </Section>

      <Section title="Common questions">
        <p>
          <strong className="text-gray-900">How do I get an account?</strong>
          <br />
          Skemaka is invite-based. A manager invites you by email; you then sign in with Google or
          Sign in with Apple to claim your account.
        </p>
        <p>
          <strong className="text-gray-900">I can&rsquo;t see any shifts or data.</strong>
          <br />
          New accounts aren&rsquo;t attached to an organisation until a manager invites you. Ask your
          manager to send (or re-send) your invite.
        </p>
        <p>
          <strong className="text-gray-900">How do I delete my account?</strong>
          <br />
          Open the app, go to <em>Settings → Delete account</em> (or the Profile tab). This permanently
          removes your account and personal data.
        </p>
      </Section>

      <Section title="More">
        <p>
          See our <a href="/privacy" className="font-medium text-blue-600 hover:text-blue-700 transition-colors">Privacy Policy</a>{" "}
          and <a href="/terms" className="font-medium text-blue-600 hover:text-blue-700 transition-colors">Terms of Service</a>.
        </p>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3 text-gray-600 text-sm leading-relaxed">{children}</div>
    </section>
  )
}
