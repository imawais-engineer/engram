import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const jbmono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "Engram — your AI subscription, supercharged",
  description: "One memory. Every skill. Every AI. Libraries, threads, versioned skills and agent setups shared by every MCP client you connect. Built on Appwrite.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${grotesk.variable} ${jbmono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-plum font-sans text-cream">{children}</body>
    </html>
  );
}
