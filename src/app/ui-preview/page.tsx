import Link from "next/link";

export default function PreviewIndex() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        fontFamily: "var(--font-preview-sans), Inter, system-ui, sans-serif",
        background: "#f5f6f8",
        color: "#1a1d26",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>
          UI Directions Preview
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          Two production-grade design directions for Hossein Starship.
        </p>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <Link
          href="/ui-preview/clinical"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 44,
            padding: "0 24px",
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 8,
            background: "#1a1d26",
            color: "#fff",
            textDecoration: "none",
            transition: "opacity 150ms",
          }}
        >
          A &mdash; Clinical Intelligence OS
        </Link>
        <Link
          href="/ui-preview/starship"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 44,
            padding: "0 24px",
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#1a1d26",
            textDecoration: "none",
            transition: "opacity 150ms",
          }}
        >
          B &mdash; Starship Spatial
        </Link>
      </div>
    </div>
  );
}
