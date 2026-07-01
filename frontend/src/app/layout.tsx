import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAR Progress Tracking",
  description: "Placement progress tracking for placement officers — CAR Initiative",
};

// Runs before first paint to apply the persisted/system theme, preventing a
// flash of the wrong color scheme on load.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
