import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for Cook with Lucia.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight mb-8">
        Terms of Service
      </h1>
      <p className="text-muted-foreground mb-8">
        Last updated: March 9, 2026
      </p>

      <div className="prose prose-neutral max-w-none space-y-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:text-muted-foreground [&_li]:leading-relaxed">
        <h2>Acceptance of Terms</h2>
        <p>
          By accessing and using cookwithlucia.com (&quot;the Website&quot;),
          you agree to be bound by these Terms of Service. If you do not agree
          to these terms, please do not use the Website.
        </p>

        <h2>Use of Content</h2>
        <p>
          All recipes, articles, images, and other content on the Website are
          owned by Cook with Lucia unless otherwise stated. You may:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>View and print content for personal, non-commercial use</li>
          <li>
            Share links to our content on social media with proper attribution
          </li>
        </ul>
        <p>You may not:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Reproduce, distribute, or republish our content without written
            permission
          </li>
          <li>Use our content for commercial purposes without authorization</li>
          <li>
            Remove any copyright or proprietary notices from our content
          </li>
        </ul>

        <h2>Recipe Disclaimer</h2>
        <p>
          Recipes on this Website are provided for informational purposes only.
          We make no guarantees regarding nutritional information, cooking times,
          or outcomes. Always use your own judgment when preparing food,
          especially regarding food allergies and dietary restrictions.
        </p>

        <h2>Third-Party Links</h2>
        <p>
          The Website may contain links to third-party websites. We are not
          responsible for the content, privacy practices, or availability of
          these external sites.
        </p>

        <h2>Advertisements</h2>
        <p>
          The Website may display advertisements through third-party ad
          networks. We are not responsible for the content of these
          advertisements or the products and services they promote.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          Cook with Lucia is provided &quot;as is&quot; without warranties of
          any kind. We shall not be liable for any damages arising from the use
          of this Website or reliance on its content.
        </p>

        <h2>Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms of Service at any time.
          Continued use of the Website after changes constitutes acceptance of
          the updated terms.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have any questions about these Terms of Service, please contact
          us at contact@cookwithlucia.com.
        </p>
      </div>
    </div>
  );
}
