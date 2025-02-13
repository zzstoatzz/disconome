import type { Metadata } from "next";
import { Fira_Code } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
});

export const metadata: Metadata = {
  title: "Discono.me",
  description: "Discover lineages and connections",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${firaCode.variable} font-mono antialiased bg-gray-50 dark:bg-gray-900 transition-colors duration-200`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
