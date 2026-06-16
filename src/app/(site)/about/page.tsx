import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "About Cook with Yara — Mediterranean and Levantine recipes built around fresh herbs, warm spices, and food worth gathering around.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight mb-8">
        About Cook with Yara
      </h1>

      <div className="relative mb-10 overflow-hidden rounded-2xl">
        <Image
          src="/hero-yara-kitchen.webp"
          alt="Yara's kitchen"
          width={1672}
          height={941}
          className="h-auto w-full object-cover"
          priority
        />
      </div>

      <div className="prose prose-neutral max-w-none space-y-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground">
        <p>
          Hi, I&apos;m Yara. Cook with Yara is where I share the Mediterranean
          and Levantine cooking I grew up around — dishes built on fresh herbs,
          warm spices, olive oil, and the kind of food that brings people to the
          table.
        </p>

        <h2>What you&apos;ll find here</h2>
        <p>
          Every recipe is written to be easy to follow at home: clear
          ingredients, step-by-step instructions, cook times, and the little
          details that make a dish work. From quick weeknight dinners to slow
          weekend bakes, the goal is food that&apos;s approachable, generous, and
          worth making again.
        </p>

        <h2>Our kitchen values</h2>
        <p>
          The recipes here are family-friendly and halal — no pork or alcohol in
          any dish. We focus on wholesome, widely-loved ingredients so the
          recipes work for as many home cooks as possible.
        </p>

        <h2>Get in touch</h2>
        <p>
          Have a question, a suggestion, or just want to say hello? I&apos;d love
          to hear from you — head over to the{" "}
          <Link href="/contact" className="text-primary underline">
            contact page
          </Link>
          . You can also follow along on{" "}
          <a
            href="https://pinterest.com/cookwithyara"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Pinterest
          </a>{" "}
          for new recipes.
        </p>
      </div>
    </div>
  );
}
