import type { Metadata } from "next";
import { Fira_Code } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";
import Footer from "@/components/Footer";

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
});

export const metadata: Metadata = {
  title: "discono.me",
  description: "Discover lineages and connections",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${firaCode.variable} font-mono antialiased bg-gray-50 dark:bg-gray-900 transition-colors duration-200 h-full flex flex-col`}
      >
        <ThemeToggle />
        <main
          className="flex-1 overflow-auto"
          role="main"
          aria-label="Main content"
        >
          {children}
        </main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
