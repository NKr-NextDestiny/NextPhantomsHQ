import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next Phantoms HQ",
  description: "Next Phantoms HQ - Team Management",
  icons: { icon: "/images/logo_icon.png" },
  manifest: "/manifest.json",
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Next Phantoms HQ",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
