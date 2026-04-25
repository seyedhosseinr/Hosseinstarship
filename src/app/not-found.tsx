import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center space-y-6" dir="auto">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/5">
          <FileQuestion className="h-10 w-10 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight text-primary">
            404
          </h1>
          <h2 className="text-xl font-semibold text-foreground">
            صفحه یافت نشد
          </h2>
          <p className="text-sm max-w-sm mx-auto text-muted-foreground">
            صفحه‌ای که به دنبال آن هستید وجود ندارد یا جابه‌جا شده است.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Home className="h-4 w-4" />
          بازگشت به خانه
        </Link>
      </div>
    </div>
  );
}
