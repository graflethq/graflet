import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Design uses JetBrains Mono as the terminal/heading face; Geist for body sans.
// Variable names match the @theme tokens (--font-sans / --font-mono) in globals.css.
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Graflet — knowledge graphs for your docs",
  description:
    "One command to pull any library's docs plus a ready-made knowledge graph, locally aligned for your AI tools. Free and open source.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Frame A is dark-committed: force the dark theme class (ADR/spec: light theme optional/later).
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
