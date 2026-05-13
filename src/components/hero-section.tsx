import Image from "next/image";
import Link from "next/link";

const heroCuisines = [
  {
    slug: "lebanese",
    label: "Lebanese",
    tagline: "Mezze & Levantine classics",
  },
  {
    slug: "moroccan",
    label: "Moroccan",
    tagline: "Tagines & North African spice",
  },
  {
    slug: "greek",
    label: "Greek",
    tagline: "Olive oil, lemon, the sea",
  },
];

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Desktop hero photo (16:9) */}
      <div className="absolute inset-0 -z-10 hidden md:block">
        <Image
          src="/hero-yara-kitchen.webp"
          alt="Yara plating a Mediterranean tabbouleh in her kitchen"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
      </div>

      {/* Mobile hero photo (9:16 portrait) */}
      <div className="absolute inset-0 -z-10 md:hidden">
        <Image
          src="/hero-yara-mobile.webp"
          alt="Yara plating a Mediterranean tabbouleh in her kitchen"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
      </div>

      {/* Soft top wash for headline readability on mobile (photo gets darker mid-frame) */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/35 via-transparent to-transparent md:hidden" />

      {/* Headline area — top-anchored on mobile (portrait photo), centered on desktop (landscape photo) */}
      <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-start px-6 pt-20 pb-44 sm:pt-24 sm:pb-64 md:min-h-[88vh] md:justify-center md:pt-28 md:pb-72">
        <div className="max-w-xl md:max-w-2xl lg:max-w-4xl">
          {/* Eyebrow with author byline */}
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-foreground/40" aria-hidden="true" />
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-foreground/70">
              Welcome in &middot; Yara&apos;s kitchen
            </p>
          </div>

          {/* Headline — bold high-contrast serif, 2 rows: regular + italic */}
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.0] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">
            Mediterranean recipes,
            <br />
            <span className="italic text-primary">made with love.</span>
          </h1>

          {/* Supporting copy */}
          <p className="mt-6 max-w-md text-base leading-relaxed text-foreground/85 sm:text-lg">
            Hi, I&apos;m Yara — so glad you&apos;re here. I cook Mediterranean
            and Levantine food in my own kitchen and write every recipe like
            I&apos;m teaching a friend.
            <span className="text-foreground"> No fuss, just good food.</span>
          </p>

          {/* CTAs — stacked on mobile, inline on desktop */}
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-x-6 sm:gap-y-3">
            <Link
              href="/recipes"
              className="group inline-flex h-12 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
            >
              Show me the recipes
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                &rarr;
              </span>
            </Link>
            <Link
              href="#newsletter"
              className="inline-flex items-center text-sm font-medium text-foreground underline-offset-4 hover:underline sm:h-12"
            >
              Or come say hi &rarr;
            </Link>
          </div>

          {/* Trust signals — friendly tone */}
          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground/60 md:mt-10">
            <li className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
              Made with real ingredients
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
              Cooked in my own kitchen
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
              Something new every Sunday
            </li>
          </ul>
        </div>
      </div>

      {/* Glassmorphism cuisine cards bleeding into the bottom */}
      <div className="absolute bottom-4 left-0 right-0 z-10 sm:bottom-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {heroCuisines.map((c, i) => (
              <Link
                key={c.slug}
                href={`/cuisines/${c.slug}`}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border border-white/40 p-3 backdrop-blur-md transition-all duration-300 hover:border-white/60 hover:bg-white/40 sm:rounded-xl sm:p-6 ${
                  i === 1 ? "bg-foreground/15" : "bg-white/40"
                }`}
              >
                <div>
                  <p className="font-display text-sm font-medium leading-tight tracking-tight text-foreground sm:text-2xl">
                    {c.label}
                  </p>
                  <p className="mt-0.5 hidden text-xs text-foreground/75 sm:mt-1 sm:block">
                    {c.tagline}
                  </p>
                </div>
                <span className="mt-2 inline-flex items-center text-[10px] font-medium text-foreground transition-transform duration-200 group-hover:translate-x-0.5 sm:mt-4 sm:text-xs">
                  Browse &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
