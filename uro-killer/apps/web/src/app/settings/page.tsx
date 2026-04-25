"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Moon, Sun, Bell, Globe, ChevronLeft, User, Palette, Volume2 } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const [theme, setTheme] = useState("dark");
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-500/10"><Settings className="h-5 w-5 text-zinc-500" /></div>
            {"\u062A\u0646\u0638\u06CC\u0645\u0627\u062A"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{"\u0634\u062E\u0635\u06CC\u200C\u0633\u0627\u0632\u06CC \u0628\u0631\u0646\u0627\u0645\u0647"}</p>
        </div>
        <Link href="/"><Button variant="ghost" size="sm" className="gap-1">{"\u0628\u0627\u0632\u06AF\u0634\u062A"}<ChevronLeft className="h-4 w-4" /></Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" />{"\u0638\u0627\u0647\u0631"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="font-semibold text-sm">{"\u062A\u0645 \u0628\u0631\u0646\u0627\u0645\u0647"}</p><p className="text-xs text-muted-foreground">{"\u0627\u0646\u062A\u062E\u0627\u0628 \u062D\u0627\u0644\u062A \u0646\u0645\u0627\u06CC\u0634"}</p></div>
            <div className="flex gap-2">
              <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")} className="gap-1"><Sun className="h-4 w-4" />{"\u0631\u0648\u0634\u0646"}</Button>
              <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")} className="gap-1"><Moon className="h-4 w-4" />{"\u062A\u0627\u0631\u06CC\u06A9"}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" />{"\u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="font-semibold text-sm">{"\u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627\u06CC \u067E\u0648\u0634"}</p><p className="text-xs text-muted-foreground">{"\u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0645\u0631\u0648\u0631 \u0631\u0648\u0632\u0627\u0646\u0647"}</p></div>
            <Button variant={notifications ? "default" : "outline"} size="sm" onClick={() => setNotifications(!notifications)}>{notifications ? "\u0641\u0639\u0627\u0644" : "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644"}</Button>
          </div>
          <div className="flex items-center justify-between">
            <div><p className="font-semibold text-sm">{"\u0635\u062F\u0627"}</p><p className="text-xs text-muted-foreground">{"\u0627\u0641\u06A9\u062A\u200C\u0647\u0627\u06CC \u0635\u0648\u062A\u06CC"}</p></div>
            <Button variant={sound ? "default" : "outline"} size="sm" onClick={() => setSound(!sound)}><Volume2 className="h-4 w-4 mr-1" />{sound ? "\u0641\u0639\u0627\u0644" : "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4" />{"\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC"}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-black text-primary">{"\u062F\u062D"}</div>
            <div className="flex-1">
              <p className="font-bold">{"\u062F\u06A9\u062A\u0631 \u062D\u0633\u06CC\u0646\u06CC"}</p>
              <p className="text-sm text-muted-foreground">dr.hosseini@email.com</p>
            </div>
            <Button variant="outline" size="sm">{"\u0648\u06CC\u0631\u0627\u06CC\u0634"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}