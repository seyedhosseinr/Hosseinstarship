import type { ReactNode } from "react";
import "./library-theme.css";

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return <div className="library-theme min-h-screen">{children}</div>;
}
