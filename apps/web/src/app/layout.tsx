import type { Metadata } from "next";
import { Syne, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Vane — Cursor for crypto",
  description:
    "Downloadable AI workspace to debug transactions, understand contracts, and safely operate on-chain workflows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${plex.variable} ${mono.variable}`}>
      <body className="min-h-screen font-[family-name:var(--font-body)] text-[var(--color-fg)]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
