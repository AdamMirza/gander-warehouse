import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gander Parts - Aviation Parts Management",
  description: "Professional aviation parts management and inventory solutions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
