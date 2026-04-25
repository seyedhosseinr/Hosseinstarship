"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      dir="rtl"
      toastOptions={{
        className: "font-sans",
      }}
    />
  );
}