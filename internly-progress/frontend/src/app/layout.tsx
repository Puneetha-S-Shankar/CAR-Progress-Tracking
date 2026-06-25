import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAR Progress Tracking",
  description: "Placement progress tracking for placement officers — CAR Initiative",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
