import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getTheme } from "@/lib/theme.server";

// Geist зі стартового шаблону не має кириличного набору — беремо Inter.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["cyrillic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HurmaStr — облік співробітників",
  description: "HR-система: довідник співробітників, оргструктура, відпустки та лікарняні",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Тема застосовується вже на сервері — жодного миготіння при завантаженні.
  const theme = await getTheme();

  return (
    <html lang="uk" className={`${inter.variable} h-full ${theme === "dark" ? "dark" : ""}`}>
      <body className="font-sans min-h-full">{children}</body>
    </html>
  );
}
