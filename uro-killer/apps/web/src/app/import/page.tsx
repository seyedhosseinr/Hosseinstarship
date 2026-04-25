"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { notesApi, flashcardsApi, questionsApi, importApi } from "../../lib/api";
import type { NoteItem, FlashcardItem, QuestionItem } from "../../lib/types";
import { toast } from "sonner";

const Icons = {
  Notes: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>,
  Flashcards: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>,
  Questions: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
  Upload: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Refresh: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>,
  ExternalLink: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>,
};

type TabKey = "notes" | "flashcards" | "questions";

const TABS: { key: TabKey; label: string; icon: React.FC; color: string }[] = [
  { key: "notes",      label: "جزوه‌ها",     icon: Icons.Notes,      color: "emerald" },
  { key: "flashcards", label: "فلش‌کارت‌ها", icon: Icons.Flashcards, color: "blue" },
  { key: "questions",  label: "سؤالات",      icon: Icons.Questions,  color: "purple" },
];

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("notes");
  const [notesList, setNotesList] = useState<NoteItem[]>([]);
  const [flashcardsList, setFlashcardsList] = useState<FlashcardItem[]>([]);
  const [questionsList, setQuestionsList] = useState<QuestionItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [n, f, q] = await Promise.all([
        notesApi.getAll().catch(() => []),
        flashcardsApi.getAll().catch(() => []),
        questionsApi.getAll().catch(() => []),
      ]);
      setNotesList(n || []);
      setFlashcardsList(f || []);
      setQuestionsList(q || []);
    } catch (err) {
      toast.error("خطا در دریافت اطلاعات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const currentItems = activeTab === "notes" ? notesList : activeTab === "flashcards" ? flashcardsList : questionsList;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === currentItems.length) setSelected(new Set());
    else setSelected(new Set(currentItems.map((item) => item.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSelected(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    if (!window.confirm(`آیا مطمئنید که ${ids.length} آیتم حذف شود؟`)) return;

    setDeleting(true);
    try {
      if (activeTab === "notes") await notesApi.deleteMany(ids);
      else if (activeTab === "flashcards") await flashcardsApi.deleteMany(ids);
      else await questionsApi.deleteMany(ids);

      toast.success(`${ids.length} آیتم حذف شد`);
      setSelected(new Set());
      await fetchData();
    } catch (err) {
      toast.error("خطا در حذف آیتم‌ها");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm("آیا مطمئنید؟")) return;
    try {
      if (activeTab === "notes") await notesApi.deleteMany([id]);
      else if (activeTab === "flashcards") await flashcardsApi.deleteMany([id]);
      else await questionsApi.deleteMany([id]);
      toast.success("آیتم حذف شد");
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      await fetchData();
    } catch (err) {
      toast.error("خطا در حذف");
    }
  };

  const processFile = async (file: File) => {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder("utf-8").decode(buffer);
      let parsed: any;

      if (file.name.endsWith(".json")) {
        parsed = JSON.parse(text);
      } else if (file.name.endsWith(".html") || file.name.endsWith(".htm")) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        const scriptData = doc.querySelector('script[type="application/json"]');
        if (scriptData) parsed = JSON.parse(scriptData.textContent || "[]");
        else { toast.error("فایل HTML معتبر یافت نشد"); return; }
      } else {
        toast.error("فرمت غیرمجاز");
        return;
      }

      const data = Array.isArray(parsed) ? parsed : (parsed.data || parsed.items || [parsed]);
      await importApi.import(activeTab, data);
      toast.success("ایمپورت با موفقیت انجام شد");
      await fetchData();
    } catch (err: any) {
      toast.error("خطا در پردازش فایل");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const navigateTo = (tab: TabKey) => {
    const routes: Record<TabKey, string> = { notes: "/notebooks", flashcards: "/flashcards", questions: "/create" };
    window.location.href = routes[tab];
  };

  const renderItem = (item: any, index: number) => {
    const isSelected = selected.has(item.id);
    const title = activeTab === "notes" ? item.title : activeTab === "flashcards" ? item.front : item.stem;
    const subtitle = activeTab === "notes" 
      ? (item.content?.slice(0, 80) + (item.content?.length > 80 ? "..." : ""))
      : activeTab === "flashcards"
      ? (item.back?.slice(0, 80) + (item.back?.length > 80 ? "..." : ""))
      : `${(JSON.parse(item.options || "[]")).length} گزینه`;
    const date = new Date(item.createdAt || Date.now()).toLocaleDateString("fa-IR");

    return (
      <div key={item.id} className={`group flex items-center gap-3 px-4 py-3 border-b border-border/50 transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
        <button onClick={() => toggleSelect(item.id)} className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 hover:border-primary"}`}>
          {isSelected && <Icons.Check />}
        </button>
        <span className="flex-shrink-0 w-8 text-xs text-muted-foreground font-mono">{String(index + 1).padStart(3, "0")}</span>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-sm font-medium truncate" dir="auto">{title || "بدون عنوان"}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5" dir="auto">{subtitle}</p>
        </div>
        <span className="flex-shrink-0 text-[11px] text-muted-foreground">{date}</span>
        <button onClick={() => handleDeleteSingle(item.id)} className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-all" title="حذف">
          <Icons.Trash />
        </button>
      </div>
    );
  };

  const counts: Record<TabKey, number> = { notes: notesList.length, flashcards: flashcardsList.length, questions: questionsList.length };

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-right">
              <h1 className="text-2xl font-bold">📁 مدیریت فایل‌ها</h1>
              <p className="text-sm text-muted-foreground mt-1">مجموع: {counts.notes + counts.flashcards + counts.questions} آیتم</p>
            </div>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50">
              <Icons.Refresh /> بروزرسانی
            </button>
          </div>
          <div className="flex gap-1 mt-4">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <button key={tab.key} onClick={() => handleTabChange(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${isActive ? "bg-background text-foreground border border-border border-b-background -mb-px" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                  <TabIcon /> {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{counts[tab.key]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-card"
          }`}
        >
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4 text-primary">
            <Icons.Upload />
          </div>
          <h3 className="text-xl font-semibold mb-2">فایل‌های {TABS.find((t) => t.key === activeTab)?.label} خود را اینجا رها کنید</h3>
          <p className="text-sm text-muted-foreground mb-4">یا برای انتخاب فایل کلیک کنید (JSON / HTML)</p>
          <input ref={fileInputRef} type="file" accept=".json,.html,.htm" onChange={handleFileImport} className="hidden" />
          {importing && <p className="text-primary text-sm font-medium animate-pulse mt-2">⏳ در حال پردازش...</p>}
        </div>
      </div>

      {/* Toolbar & List */}
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={selectAll} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">
              {selected.size > 0 ? `${selected.size} انتخاب شده` : "انتخاب همه"}
            </button>
            {selected.size > 0 && (
              <button onClick={handleDeleteSelected} disabled={deleting} className="text-sm px-3 py-1.5 rounded-md bg-destructive text-white">
                حذف انتخاب شده‌ها
              </button>
            )}
          </div>
          <button onClick={() => navigateTo(activeTab)} className="text-sm px-3 py-1.5 rounded-md border border-border flex items-center gap-2">
            <Icons.ExternalLink /> نمایش بخش اصلی
          </button>
        </div>

        <div className="border border-border rounded-xl bg-card overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">در حال بارگذاری...</div>
          ) : currentItems.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">آیتمی برای نمایش وجود ندارد.</div>
          ) : (
            <div className="divide-y divide-border/50 text-right">
               {currentItems.map((item, i) => renderItem(item, i))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
