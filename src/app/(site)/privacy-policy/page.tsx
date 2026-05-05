import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Cook with Yara.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight mb-8">
        Privacy Policy
      </h1>
      <p className="text-muted-foreground mb-8">
        Last updated: March 9, 2026
      </p>

      <div className="prose prose-neutral max-w-none space-y-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:text-muted-foreground [&_li]:leading-relaxed">
        <h2>Introduction</h2>
        <p>
          Cook with Yara (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
          operates the website cookwithyara.com. This Privacy Policy explains
          how we collect, use, and protect your information when you visit our
          website.
        </p>

        <h2>Information We Collect</h2>
        <p>
          We may collect the following types of information:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Usage Data:</strong> Pages visited, time spent on pages,
            referring URLs, and other standard analytics data collected
            automatically through cookies and similar technologies.
          </li>
          <li>
            <strong>Email Address:</strong> If you voluntarily subscribe to our
            newsletter or contact us.
          </li>
        </ul>

        <h2>How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Provide and improve our website content</li>
          <li>Analyze website traffic and usage patterns</li>
          <li>Send newsletters or updates if you have opted in</li>
          <li>Display relevant advertisements</li>
        </ul>

        <h2>Third-Party Services</h2>
        <p>
          We may use third-party services that collect information, including:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Google AdSense:</strong> Displays advertisements and may use
            cookies to serve ads based on your browsing history.
          </li>
          <li>
            <strong>Pinterest:</strong> We use the Pinterest API to share recipe
            content. Pinterest&apos;s privacy policy governs any data processed
            through their platform.
          </li>
          <li>
            <strong>Vercel:</strong> Our hosting provider, which may collect
            standard server logs.
          </li>
        </ul>

        <h2>Cookies</h2>
        <p>
          Our website uses cookies to enhance your experience. You can control
          cookie preferences through your browser settings. Disabling cookies may
          affect some website functionality.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain your information only as long as necessary to fulfill the
          purposes outlined in this policy or as required by law.
        </p>

        <h2>Your Rights</h2>
        <p>
          Depending on your location, you may have the right to access, correct,
          delete, or restrict the processing of your personal data. To exercise
          these rights, please contact us at the email below.
        </p>

        <h2>Children&apos;s Privacy</h2>
        <p>
          Our website is not directed at children under 13. We do not knowingly
          collect personal information from children.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be
          posted on this page with an updated date.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us
          at privacy@cookwithyara.com.
        </p>
      </div>
    </div>
  );
}
