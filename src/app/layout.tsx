import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PetMarketplace",
  description: "Маркетплейс животных / Pet marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}