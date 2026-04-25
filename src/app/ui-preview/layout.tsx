import { Source_Serif_4, Inter } from "next/font/google";

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-preview-serif",
  display: "swap",
  weight: ["400", "600", "700"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-preview-sans",
  display: "swap",
});

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      dir="ltr"
      lang="en"
      className={`${serif.variable} ${sans.variable}`}
      style={{ fontFamily: "var(--font-preview-sans), Inter, system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
