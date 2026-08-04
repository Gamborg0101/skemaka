export const metadata = {
  title: "Privacy Policy – Skemaka",
}

export default function PrivacyPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-12">Last updated: 15 May 2026</p>

      <Section title="1. Who We Are">
        <p>
          Skemaka ApS (&ldquo;Skemaka&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the Skemaka staff-scheduling platform. We are
          registered in Denmark and act as the data controller for the personal data described in this
          policy. For data you enter about your employees, you are the controller and we act as your
          processor — see Section 6.
        </p>
        <p>
          Questions about this policy or your data can be directed to{" "}
          <a href="mailto:privacy@skemaka.com" className="text-blue-600 hover:underline">
            privacy@skemaka.com
          </a>
          .
        </p>
      </Section>

      <Section title="2. Data We Collect">
        <p>We collect the following categories of personal data:</p>
        <ul>
          <li>
            <strong>Account data</strong> — your name and email address, and, if you sign in with
            Google, your profile picture. This comes from Google when you use Google sign-in, or
            from the email address you enter when you sign in with a one-time email link.
          </li>
          <li>
            <strong>Organisation data</strong> — your business name and the settings you configure
            (store hours, currency, shift templates).
          </li>
          <li>
            <strong>Employee data</strong> — names, email addresses, phone numbers, job roles, hourly
            wages, contracted hours, and schedules that you enter for the people you manage.
          </li>
          <li>
            <strong>Usage data</strong> — pages visited, actions taken, and timestamps, collected to
            improve the Service and diagnose issues.
          </li>
          <li>
            <strong>Billing data</strong> — payment method details and billing address, collected and
            stored by Stripe on our behalf. We never store full card numbers.
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Data">
        <p>We use the data we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve the Service.</li>
          <li>Authenticate you and keep your account secure.</li>
          <li>Process subscription payments and send receipts.</li>
          <li>Send transactional emails (schedule invites, availability requests, account notices).</li>
          <li>Respond to support requests.</li>
          <li>Comply with legal obligations.</li>
        </ul>
        <p>
          We do not sell your personal data or use it to serve third-party advertising.
        </p>
      </Section>

      <Section title="4. Legal Bases for Processing (GDPR)">
        <p>
          Where the GDPR applies, we rely on the following legal bases:
        </p>
        <ul>
          <li>
            <strong>Contract</strong> — processing necessary to provide the Service you signed up for
            (account management, scheduling, billing).
          </li>
          <li>
            <strong>Legitimate interests</strong> — usage analytics and security monitoring, where our
            interests do not override your rights.
          </li>
          <li>
            <strong>Legal obligation</strong> — retaining billing records as required by tax law.
          </li>
          <li>
            <strong>Consent</strong> — where we have asked for and received your consent, such as for
            optional marketing communications.
          </li>
        </ul>
      </Section>

      <Section title="5. Third-Party Services">
        <p>We share data with the following sub-processors to operate the Service:</p>
        <ul>
          <li>
            <strong>Google</strong> — authentication via Google OAuth. Google&rsquo;s{" "}
            <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener">
              Privacy Policy
            </a>{" "}
            applies to data processed by Google.
          </li>
          <li>
            <strong>Neon</strong> — PostgreSQL database hosting. Data is stored in the EU
            (eu-central-1, Frankfurt). Neon is GDPR-compliant and processes data under a DPA.
          </li>
          <li>
            <strong>Stripe</strong> — payment processing. Stripe is PCI DSS Level 1 certified and
            GDPR-compliant. See Stripe&rsquo;s{" "}
            <a href="https://stripe.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener">
              Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Vercel</strong> — application hosting and edge delivery. Data in transit passes
            through Vercel&rsquo;s infrastructure.
          </li>
        </ul>
        <p>
          A complete, current list of our sub-processors — including Twilio (SMS), Resend (email), and
          Upstash (rate limiting) — is maintained at{" "}
          <a href="/subprocessors" className="text-blue-600 hover:underline">
            skemaka.com/subprocessors
          </a>
          . We require all sub-processors to maintain appropriate security measures and process data
          only as instructed.
        </p>
      </Section>

      <Section title="6. Employee Data — Controller vs. Processor">
        <p>
          When you add employee records to Skemaka, you are the data controller for that personal data
          and you are responsible for having a lawful basis to process it (e.g. employment contract,
          legitimate interest). Skemaka acts as a data processor, handling that data solely to provide
          the scheduling features you have requested.
        </p>
        <p>
          A Data Processing Agreement (DPA) governing this relationship is available on request at{" "}
          <a href="mailto:privacy@skemaka.com" className="text-blue-600 hover:underline">
            privacy@skemaka.com
          </a>
          .
        </p>
      </Section>

      <Section title="7. Data Retention">
        <p>
          We retain your account and organisation data for as long as your account is active and for up
          to 90 days after deletion, to allow recovery if you change your mind. Billing records are
          retained for 5 years to comply with Danish bookkeeping law.
        </p>
        <p>
          When you delete your account, we permanently delete all associated personal data (schedules,
          employees, settings) within 90 days, except where retention is required by law.
        </p>
      </Section>

      <Section title="8. Data Security">
        <p>
          All data is encrypted in transit (TLS 1.2+) and at rest. Access to production systems is
          restricted to authorised personnel. We use JWT-based authentication with short-lived tokens
          and conduct periodic security reviews.
        </p>
        <p>
          In the event of a data breach affecting your personal data, we will notify you and the
          relevant supervisory authority within 72 hours where required by law.
        </p>
      </Section>

      <Section title="9. Cookies">
        <p>
          We use a single session cookie to keep you signed in. We do not use tracking, analytics, or
          advertising cookies. No cookie banner is shown because we only set cookies that are strictly
          necessary to operate the Service.
        </p>
      </Section>

      <Section title="10. Your Rights">
        <p>
          Under the GDPR you have the right to:
        </p>
        <ul>
          <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
          <li><strong>Rectification</strong> — ask us to correct inaccurate data.</li>
          <li><strong>Erasure</strong> — ask us to delete your data (&ldquo;right to be forgotten&rdquo;).</li>
          <li><strong>Portability</strong> — receive your data in a structured, machine-readable format.</li>
          <li><strong>Restriction</strong> — ask us to pause processing while a dispute is resolved.</li>
          <li><strong>Objection</strong> — object to processing based on legitimate interests.</li>
          <li><strong>Withdraw consent</strong> — where processing is based on consent, withdraw it at any time.</li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:privacy@skemaka.com" className="text-blue-600 hover:underline">
            privacy@skemaka.com
          </a>
          . We will respond within 30 days. You also have the right to lodge a complaint with the Danish
          Data Protection Authority (Datatilsynet) at{" "}
          <a href="https://www.datatilsynet.dk" className="text-blue-600 hover:underline" target="_blank" rel="noopener">
            datatilsynet.dk
          </a>
          .
        </p>
      </Section>

      <Section title="11. International Transfers">
        <p>
          Your data is stored in the EU (Frankfurt). Some sub-processors may transfer data outside the
          EEA; where they do, we ensure appropriate safeguards are in place (e.g. EU Standard
          Contractual Clauses or an adequacy decision).
        </p>
      </Section>

      <Section title="12. Changes to This Policy">
        <p>
          We may update this policy from time to time. We will notify you of material changes by email
          or in-app notice at least 14 days before they take effect. The &ldquo;Last updated&rdquo; date at the top
          of this page reflects the most recent revision.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          Skemaka ApS<br />
          Copenhagen, Denmark<br />
          <a href="mailto:privacy@skemaka.com" className="text-blue-600 hover:underline">
            privacy@skemaka.com
          </a>
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
