import { MDXRemote } from "next-mdx-remote/rsc";
import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const components: MDXComponents = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => {
    const text =
      typeof props.children === "string"
        ? props.children
        : String(props.children ?? "");
    const id = slugify(text);
    return <h2 id={id} className="scroll-mt-24" {...props} />;
  },
};

/**
 * Insert the hero image into the MDX body after the introduction
 * (right before the first ## heading) so articles have a visual break.
 */
function injectBodyImage(source: string, imageUrl: string, alt: string): string {
  const firstH2 = source.indexOf("\n## ");
  if (firstH2 === -1) return source;

  const imgMarkdown = `\n![${alt}](${imageUrl})\n`;
  return source.slice(0, firstH2) + imgMarkdown + source.slice(firstH2);
}

export function RecipeContent({
  source,
  heroImageUrl,
  heroAlt,
}: {
  source: string;
  heroImageUrl?: string | null;
  heroAlt?: string;
}) {
  const mdx =
    heroImageUrl
      ? injectBodyImage(source, heroImageUrl, heroAlt || "Recipe photo")
      : source;

  return (
    <div className="recipe-prose">
      <MDXRemote source={mdx} components={components} />
    </div>
  );
}
