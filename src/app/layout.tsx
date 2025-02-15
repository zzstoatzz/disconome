import type { Metadata } from "next";
import { Fira_Code } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";
import Footer from "@/components/Footer";
import MouseTrail from "@/components/MouseTrail";

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
});

export const metadata: Metadata = {
  title: "discono.me",
  description: "Timeline of a thing",
  metadataBase: new URL("https://discono.me"),
  openGraph: {
    title: "discono.me",
    description: "Timeline of a thing",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "discono.me",
    description: "Timeline of a thing",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta
          name="theme-color"
          content="#ffffff"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#111827"
          media="(prefers-color-scheme: dark)"
        />
      </head>
      <body
        className={`${firaCode.variable} font-mono antialiased bg-gray-50 dark:bg-gray-900 h-full flex flex-col`}
      >
        <MouseTrail />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:dark:bg-gray-800"
        >
          Skip to main content
        </a>
        <ThemeToggle />
        <main
          id="main-content"
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
