import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ORCA",
  description: "Optimized Routing and Carbon Analytics"
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        <nav className="flex gap-4 border-b border-slate-200 bg-white px-6 py-3 text-sm font-medium">
          <Link href="/">Shipments</Link>
          <Link href="/optimize">Optimize</Link>
          <Link href="/carbon">Carbon</Link>
          <Link href="/hubs">Hubs</Link>
        </nav>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}
