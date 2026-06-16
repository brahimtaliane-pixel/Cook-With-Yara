import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Cook with Yara — questions, feedback, and recipe suggestions are always welcome.",
  alternates: { canonical: "/contact" },
};

const CONTACT_EMAIL = "hello@cookwithyara.com";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight mb-8">
        Contact
      </h1>

      <div className="prose prose-neutral max-w-none space-y-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground">
        <p>
          I&apos;d love to hear from you. Whether it&apos;s a question about a
          recipe, feedback, a suggestion for a dish you&apos;d like to see, or a
          partnership enquiry, get in touch and I&apos;ll do my best to reply.
        </p>

        <h2>Email</h2>
        <p>
          The best way to reach me is by email:
          <br />
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>

        <h2>Pinterest</h2>
        <p>
          You can also find new recipes and message me on{" "}
          <a
            href="https://pinterest.com/cookwithyara"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Pinterest
          </a>
          .
        </p>

        <p>
          I read every message and typically respond within a few business days.
        </p>
      </div>
    </div>
  );
}
