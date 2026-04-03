import type { Metadata } from "next";
import { TestThemeBridge } from "./_components/test-theme-bridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "ШалгалтХамгаалагч - Шууд Хяналт",
  description: "Багш нарт зориулсан шалгалтын шууд хяналтын самбар",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="font-sans antialiased">
      <TestThemeBridge />
      {children}
    </div>
  );
}
