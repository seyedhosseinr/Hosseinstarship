export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      dir="ltr"
      lang="en"
      style={{
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        "--font-preview-sans": "Inter, system-ui, sans-serif",
        "--font-preview-serif": "'Source Serif 4', Georgia, 'Times New Roman', serif",
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
