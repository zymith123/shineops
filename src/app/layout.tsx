import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShineOps",
  description: "Client retention & operations for recurring cleaning businesses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
