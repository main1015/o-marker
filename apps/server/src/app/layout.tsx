import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "o-marker Dashboard",
  description: "Next-gen Bookmark Manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
