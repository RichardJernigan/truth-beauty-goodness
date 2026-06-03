import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Truth · Beauty · Goodness",
  description: "An interactive Venn diagram",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
