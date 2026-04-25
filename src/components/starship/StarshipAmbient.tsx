export default function StarshipAmbient() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60rem 60rem at 10% 10%, rgba(124,58,237,0.18), transparent 60%), radial-gradient(50rem 50rem at 90% 20%, rgba(6,182,212,0.12), transparent 60%), radial-gradient(55rem 55rem at 50% 100%, rgba(59,130,246,0.12), transparent 60%), linear-gradient(180deg, #050816 0%, #070b1a 45%, #060812 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.14) 0.6px, transparent 0.6px)",
          backgroundSize: "26px 26px",
          maskImage: "linear-gradient(to bottom, rgba(255,255,255,0.6), rgba(255,255,255,0.15))",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(255,255,255,0.6), rgba(255,255,255,0.15))",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -right-24 top-12 z-0 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "rgba(139,92,246,0.16)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -left-20 bottom-10 z-0 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "rgba(6,182,212,0.12)" }}
      />
    </>
  );
}
