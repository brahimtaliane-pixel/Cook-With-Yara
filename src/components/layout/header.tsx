"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/categories/main-course", label: "Main Courses" },
  { href: "/categories/dessert", label: "Desserts" },
  { href: "/categories/salad", label: "Salads" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 sm:h-20">
        {/* Logo */}
        <Link href="/" className="block shrink-0" aria-label="Cook with Yara — Home">
          <Image
            src="/logo.png"
            alt="Cook with Yara"
            width={540}
            height={160}
            className="h-12 w-auto sm:h-14"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`group relative rounded-full px-4 py-2 text-sm font-medium transition-all ${
                isActive(link.href)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
              {/* Hover underline animation */}
              <span
                className={`absolute bottom-1 left-4 right-4 h-0.5 rounded-full bg-primary transition-transform duration-300 origin-left ${
                  isActive(link.href)
                    ? "scale-x-100"
                    : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </Link>
          ))}

          {/* CTA pill */}
          <Link
            href="/recipes"
            className="ml-3 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Browse Recipes
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out md:hidden ${
          mobileOpen ? "max-h-96" : "max-h-0"
        }`}
      >
        <nav className="flex flex-col gap-1 border-t border-border/60 px-6 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/recipes"
            onClick={() => setMobileOpen(false)}
            className="mt-2 rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Browse Recipes
          </Link>
        </nav>
      </div>
    </header>
  );
}
