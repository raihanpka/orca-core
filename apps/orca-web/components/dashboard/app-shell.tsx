import Link from "next/link";
import {cn} from "@/lib/utils";

const navItems = [
  {href: "/", label: "Dashboard"},
  {href: "/optimize", label: "Route Optimizer"},
  {href: "/carbon", label: "Carbon"},
  {href: "/hubs", label: "Hubs"}
];

export function AppShell({children}: {children: React.ReactNode}) {
  return (
    <body className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-slate-200 bg-white lg:block">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="text-lg font-semibold tracking-normal">ORCA</div>
            <div className="mt-1 text-xs text-slate-500">Operational Route and Carbon Analytics</div>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <div className="text-base font-semibold">ORCA</div>
            <nav className="mt-3 flex gap-2 overflow-x-auto text-sm">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-md border border-slate-200 px-3 py-1.5">
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </body>
  );
}
