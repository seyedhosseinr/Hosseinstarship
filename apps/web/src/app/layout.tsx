import type { Metadata } from "next";
import "./globals.css";
import ClientShell from "@/components/layout/client-shell";

export const metadata: Metadata = {
  title: "URO-OMEGA",
  description: "\u0633\u0627\u0645\u0627\u0646\u0647 \u0622\u0632\u0645\u0648\u0646 \u0627\u0631\u0648\u0644\u0648\u0698\u06CC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className="dark">
      <body className="min-h-screen bg-black font-sans text-white antialiased">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}