import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextPhantoms",
  description: "NextPhantoms Team Management",
  icons: { icon: "/images/logo_icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
