import Link from "next/link";
import {
  LayoutDashboard,
  KeyRound,
  FileText,
  Workflow,
  Settings,
  Telescope,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/keywords", label: "Keywords", icon: KeyRound },
  { href: "/admin/articles", label: "Articles", icon: FileText },
  { href: "/admin/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/admin/intel", label: "Intel", icon: Telescope },
  { href: "/admin/config", label: "Config", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="w-56 shrink-0 border-r bg-muted/30">
        <div className="px-4 py-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin Panel
          </h2>
          <nav className="flex flex-col gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
