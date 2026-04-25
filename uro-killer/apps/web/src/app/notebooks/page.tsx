"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronLeft, FileText, Plus, FolderOpen } from "lucide-react";
import Link from "next/link";

const NOTEBOOKS = [
  { id: 1, title: "\u06A9\u0645\u067E\u0628\u0644 \u0627\u0648\u0631\u0648\u0644\u0648\u0698\u06CC", chapters: 85, progress: 45 },
  { id: 2, title: "\u06AF\u0627\u06CC\u062F\u0644\u0627\u06CC\u0646 AUA 2024", chapters: 12, progress: 80 },
  { id: 3, title: "\u062C\u0632\u0648\u0647 \u0633\u0646\u06AF\u200C\u0647\u0627\u06CC \u0627\u062F\u0631\u0627\u0631\u06CC", chapters: 8, progress: 100 },
  { id: 4, title: "\u0646\u06A9\u0627\u062A \u06A9\u0644\u06CC\u062F\u06CC \u0627\u0646\u062F\u0648\u06CC\u0648\u0631\u0648\u0644\u0648\u0698\u06CC", chapters: 15, progress: 30 },
];

export default function NotebooksPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10"><BookOpen className="h-5 w-5 text-pink-500" /></div>
            {"\u062C\u0632\u0648\u0647\u200C\u0647\u0627"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{"\u0645\u0646\u0627\u0628\u0639 \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" />{"\u062C\u062F\u06CC\u062F"}</Button>
          <Link href="/"><Button variant="ghost" size="sm" className="gap-1">{"\u0628\u0627\u0632\u06AF\u0634\u062A"}<ChevronLeft className="h-4 w-4" /></Button></Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {NOTEBOOKS.map((nb) => (
          <Card key={nb.id} className="card-hover cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/10"><FolderOpen className="h-6 w-6 text-pink-500" /></div>
                <div className="flex-1">
                  <h3 className="font-bold text-base mb-1">{nb.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{nb.chapters} {"\u0641\u0635\u0644"}</span>
                    <Badge variant={nb.progress === 100 ? "default" : "secondary"}>{nb.progress}% {"\u0645\u0637\u0627\u0644\u0639\u0647"}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}