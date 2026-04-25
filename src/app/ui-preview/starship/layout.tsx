import "./tokens.css";

export default function StarshipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-starship" style={{ minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
