import "./globals.css";
import type { Metadata } from "next";
import { Libre_Baskerville, Work_Sans } from "next/font/google";
import { WizardProvider } from "./components/wizard-context";

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

const libre = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Byggplattformen",
  description: "Beslutsstöd i tidigt skede för byggprojekt.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" className={`${workSans.variable} ${libre.variable}`}>
      <body className="font-sans bg-[#FAF8F5] text-[#2A2520] antialiased">
        <WizardProvider>{children}</WizardProvider>
      </body>
    </html>
  );
}