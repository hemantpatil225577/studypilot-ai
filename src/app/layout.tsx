import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "StudyPilot AI",
  description: "Plan your revision, practise with an AI tutor, and track real progress.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
