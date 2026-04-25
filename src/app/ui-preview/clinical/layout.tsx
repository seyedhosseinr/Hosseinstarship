import "./tokens.css";

export default function ClinicalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      dir="rtl"
      lang="fa"
      className="theme-clinical"
      style={{ minHeight: "100dvh" }}
    >
      {children}
    </div>
  );
}
