"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    const content = contentRef.current;
    if (!section || !image || !content) return;

    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = section!.getBoundingClientRect();
        const sectionHeight = section!.offsetHeight;
        // How far we've scrolled past the top (0 = top visible, sectionHeight = fully scrolled past)
        const scrolled = Math.max(0, -rect.top);
        const progress = Math.min(scrolled / sectionHeight, 1);

        // Image: slow zoom in + fade out
        const scale = 1 + progress * 0.15;
        const imageOpacity = 1 - progress * 0.6;
        image!.style.transform = `scale(${scale})`;
        image!.style.opacity = String(imageOpacity);

        // Content: float up + fade out
        const translateY = -progress * 80;
        const contentOpacity = 1 - progress * 1.5;
        content!.style.transform = `translateY(${translateY}px)`;
        content!.style.opacity = String(Math.max(0, contentOpacity));

        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section ref={sectionRef} className="relative min-h-[90vh] overflow-hidden">
      <div ref={imageRef} className="absolute inset-0 will-change-transform">
        <Image
          src="/herosecion.webp"
          alt="Delicious home-cooked food"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,251,245,0.85)_0%,rgba(255,251,245,0.4)_60%,transparent_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[90vh] max-w-7xl items-center px-6 py-20 sm:py-28">
        <div ref={contentRef} className="mx-auto max-w-2xl text-center will-change-transform">
          <p className="animate-fade-in text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Fresh recipes daily
          </p>
          <h1 className="animate-fade-in-up mt-5 font-display text-5xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Simple recipes,{" "}
            <span className="italic text-primary">made with love</span>
          </h1>
          <p className="animate-fade-in-up stagger-1 mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Hi, I&apos;m Lucia! I create delicious recipes that anyone can make
            at home. From quick weeknight dinners to show-stopping desserts.
          </p>
          <div className="animate-fade-in-up stagger-2 mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/recipes"
              className="rounded-full bg-primary px-9 py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:shadow-lg hover:brightness-110"
            >
              Browse Recipes
            </Link>
            <a
              href="#newsletter"
              className="rounded-full border border-foreground/20 bg-white/60 px-9 py-3.5 text-sm font-semibold text-foreground backdrop-blur-sm transition-all hover:bg-white/80"
            >
              Join Newsletter
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
