export function KnowledgeSphereEmptyState() {
  return (
    <div
      dir="rtl"
      className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300/80 bg-slate-50/70 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800">
        ◌
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        هنوز داده کافی برای ساخت نقشه دانش وجود ندارد.
      </h3>
      <p className="mt-2 max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300">
        برای فعال شدن این بخش، چند فصل را در Reader باز کنید، چند MCQ حل کنید یا
        فلش‌کارت‌ها را مرور کنید. صرفاً داشتن metadata فصل‌ها باعث نمایش نقشه نمایشی نمی‌شود.
      </p>
    </div>
  );
}
