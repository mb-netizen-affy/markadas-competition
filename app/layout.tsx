import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";

// Même police que le site Markadas
const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  title: "Compétition Markadas",
  description: "Gestion de la compétition annuelle des écoles de danse Markadas",
};

export const viewport: Viewport = {
  themeColor: "#121417",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={openSans.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}