import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biodata intake",
  description:
    "Record and review biodata submissions with live age and BMI calculation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 bg-[radial-gradient(60rem_40rem_at_50%_-10rem,rgba(99,102,241,0.12),transparent)] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
