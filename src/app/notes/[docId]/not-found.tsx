import Link from "next/link";

export default function NoteNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50" dir="rtl">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">
          جزوه یافت نشد
        </h1>
        <p className="text-neutral-600 mb-8">
          این جزوه وجود ندارد یا حذف شده است.
        </p>
        <Link 
          href="/dashboard"
          className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
        >
          بازگشت به داشبورد
        </Link>
      </div>
    </div>
  );
}
