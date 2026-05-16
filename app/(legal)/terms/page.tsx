export const metadata = {
  title: "Terms of Service – Skemaka",
}

export default function TermsPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-12">Last updated: 15 May 2026</p>

      <Section title="1. Introduction">
        <p>
          These Terms of Service ("Terms") govern your access to and use of Skemaka ("the Service"), a
          staff-scheduling platform operated by Skemaka ApS, a company registered in Denmark. By creating
          an account or using the Service you agree to be bound by these Terms. If you do not agree, do
          not use the Service.
        </p>
      </Section>

      <Section title="2. The Service">
        <p>
          Skemaka provides tools for scheduling employees, tracking labour costs, and managing staff
          availability. The Service is intended for business owners, managers, and their employees working
          in the food-and-beverage and hospitality industries.
        </p>
        <p>
          We reserve the right to modify, suspend, or discontinue any part of the Service at any time
          with reasonable notice where possible.
        </p>
      </Section>

      <Section title="3. Accounts">
        <p>
          You must sign in using a valid Google account. You are responsible for maintaining the
          confidentiality of your account and for all activity that occurs under it. You must be at least
          18 years old and have the legal authority to enter into this agreement on behalf of your
          organisation.
        </p>
        <p>
          One Skemaka account corresponds to one organisation. You may not share login credentials or use
          the Service to manage multiple unrelated businesses under a single subscription.
        </p>
      </Section>

      <Section title="4. Subscriptions and Payment">
        <p>
          Access to paid features requires an active subscription. Subscription fees are billed in advance
          on a monthly or annual basis via Stripe. All prices are stated excluding VAT unless otherwise
          noted. VAT will be added at checkout based on your billing country.
        </p>
        <p>
          You may cancel your subscription at any time. Cancellation takes effect at the end of your
          current billing period. We do not issue refunds for unused portions of a subscription period
          except where required by applicable law.
        </p>
        <p>
          We reserve the right to change pricing with at least 30 days' notice. Continued use of the
          Service after a price change constitutes acceptance of the new pricing.
        </p>
      </Section>

      <Section title="5. Acceptable Use">
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation.</li>
          <li>Upload or transmit content that is defamatory, fraudulent, or violates the rights of others.</li>
          <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure.</li>
          <li>Reverse-engineer, decompile, or otherwise attempt to extract the source code of the Service.</li>
          <li>Use automated scripts or bots to access the Service in ways that impose an unreasonable load.</li>
          <li>Resell or sublicense access to the Service without our written consent.</li>
        </ul>
      </Section>

      <Section title="6. Employee Data">
        <p>
          You are the data controller for any personal data you upload or generate within the Service,
          including employee names, contact details, schedules, and wages. Skemaka acts as a data
          processor on your behalf.
        </p>
        <p>
          You are responsible for obtaining any necessary consent from your employees and for ensuring
          that your use of the Service complies with applicable employment and data-protection laws,
          including the General Data Protection Regulation (GDPR).
        </p>
        <p>
          A Data Processing Agreement (DPA) is available on request and is incorporated into these Terms
          by reference.
        </p>
      </Section>

      <Section title="7. Intellectual Property">
        <p>
          The Service, including its design, code, and content, is owned by Skemaka ApS and protected by
          copyright and other intellectual property laws. These Terms do not grant you any ownership
          rights to the Service.
        </p>
        <p>
          You retain ownership of the data you input into the Service. You grant us a limited licence to
          store, process, and display that data solely to provide the Service to you.
        </p>
      </Section>

      <Section title="8. Availability and Support">
        <p>
          We aim for high availability but do not guarantee uninterrupted access. Planned maintenance
          will be communicated in advance where possible. We provide support via email on business days.
        </p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Skemaka ApS shall not be liable for any indirect,
          incidental, consequential, or punitive damages arising from your use of, or inability to use,
          the Service. Our total liability for any claim arising out of or relating to these Terms shall
          not exceed the amount you paid to us in the three months preceding the claim.
        </p>
        <p>
          Nothing in these Terms limits liability that cannot be excluded under applicable law, including
          liability for gross negligence, wilful misconduct, or death or personal injury caused by our
          negligence.
        </p>
      </Section>

      <Section title="10. Termination">
        <p>
          Either party may terminate the agreement at any time. We may suspend or terminate your account
          immediately if you materially breach these Terms or if continued access would expose us or
          others to harm or legal risk. On termination, your access to the Service ceases and we will
          delete your data in accordance with our Privacy Policy.
        </p>
      </Section>

      <Section title="11. Governing Law">
        <p>
          These Terms are governed by the laws of Denmark. Any disputes shall be subject to the
          exclusive jurisdiction of the courts of Copenhagen, Denmark, unless mandatory consumer
          protection laws in your country of residence require otherwise.
        </p>
      </Section>

      <Section title="12. Changes to These Terms">
        <p>
          We may update these Terms from time to time. We will notify you of material changes by email
          or via an in-app notice at least 14 days before the changes take effect. Continued use of the
          Service after that date constitutes your acceptance of the updated Terms.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          If you have questions about these Terms, please contact us at{" "}
          <a href="mailto:legal@skemaka.com" className="text-blue-600 hover:underline">
            legal@skemaka.com
          </a>
          .
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
