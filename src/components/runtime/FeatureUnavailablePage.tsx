"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FeatureUnavailablePageProps = {
  title: string;
  description: string;
};

export function FeatureUnavailablePage({ title, description }: FeatureUnavailablePageProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Card className="rounded-[32px] border-border/40 bg-card/70 p-8 shadow-sm backdrop-blur-xl dark:bg-card/40">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-warning/10 p-3 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Postgres Runtime</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
              </div>
              <p className="text-sm leading-7 text-muted-foreground">{description}</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-2xl">
                  <Link href="/library">
                    <BookOpen className="ml-2 h-4 w-4" />
                    بازگشت به کتابخانه
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-2xl">
                  <Link href="/settings">
                    <Settings className="ml-2 h-4 w-4" />
                    مشاهده تنظیمات
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-2xl">
                  <Link href="/dashboard">
                    <ArrowLeft className="ml-2 h-4 w-4" />
                    بازگشت به داشبورد
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
