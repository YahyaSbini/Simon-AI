import type { Metadata } from "next";
import { Architects_Daughter, Kalam } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const architectsDaughter = Architects_Daughter({
  variable: "--font-architects-daughter",
  weight: "400",
  subsets: ["latin"],
});

const kalam = Kalam({
  variable: "--font-kalam",
  weight: ["300", "400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Simon",
  description: "A personal assistant for your tasks and inbox.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${architectsDaughter.variable} ${kalam.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
