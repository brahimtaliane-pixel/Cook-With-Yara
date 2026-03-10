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

export function RecipeContent({ source }: { source: string }) {
  return (
    <div className="recipe-prose">
      <MDXRemote source={source} components={components} />
    </div>
  );
}
