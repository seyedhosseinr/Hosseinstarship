"use client";

import React from "react";

export default function NotebooksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        body { overflow: hidden !important; }

        @keyframes nb-blob-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.12); }
          66% { transform: translate(-20px, 20px) scale(0.92); }
        }
        @keyframes nb-blob-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(0.9); }
          66% { transform: translate(25px, -40px) scale(1.1); }
        }
        @keyframes nb-blob-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, 30px) scale(1.08); }
        }
      `}</style>

      <div className="relative isolate h-screen w-screen overflow-hidden bg-background">
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-[0.07] dark:opacity-[0.05]">
          <div
            className="absolute h-[600px] w-[600px] rounded-full"
            style={{
              top: "-15%",
              right: "10%",
              background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
              animation: "nb-blob-1 25s ease-in-out infinite",
              filter: "blur(80px)",
            }}
          />
          <div
            className="absolute h-[500px] w-[500px] rounded-full"
            style={{
              bottom: "-10%",
              left: "5%",
              background: "radial-gradient(circle, hsl(270 60% 60%) 0%, transparent 70%)",
              animation: "nb-blob-2 30s ease-in-out infinite",
              filter: "blur(90px)",
            }}
          />
          <div
            className="absolute h-[400px] w-[400px] rounded-full"
            style={{
              top: "40%",
              left: "50%",
              background: "radial-gradient(circle, hsl(35 90% 60%) 0%, transparent 70%)",
              animation: "nb-blob-3 20s ease-in-out infinite",
              filter: "blur(100px)",
            }}
          />
        </div>

        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.025] dark:opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 0.8px, transparent 0.8px)",
            backgroundSize: "20px 20px",
          }}
        />

        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.018] mix-blend-overlay dark:opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='512' height='512' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: "256px 256px",
          }}
        />

        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 50%, hsl(var(--background)) 100%)",
          }}
        />

        <div className="relative z-10 h-full w-full">{children}</div>
      </div>
    </>
  );
}