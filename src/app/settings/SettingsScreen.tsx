"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { getTokens } from "@/lib/theme/tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  User,
  Bell,
  Palette,
  Shield,
  Database,
  Download,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Volume2,
  VolumeX,
  Save,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { clearLocalUnlock } from "@/lib/auth/local-unlock";

type Theme = "light" | "dark" | "system";

export default function SettingsPage() {
  const resetAll = useAppStore((s) => s.resetAll);
  const [resetting, setResetting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } catch {
      /* continue — clear local state either way */
    }
    clearLocalUnlock();
    window.location.replace("/login");
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetAll();
      toast.success("\u062F\u0627\u062F\u0647\u200C\u0647\u0627 \u067E\u0627\u06A9 \u0634\u062F");
    } catch {
      toast.error("\u062E\u0637\u0627 \u062F\u0631 \u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC");
    } finally {
      setResetting(false);
    }
  };
  const [name, setName] = useState("\u062F\u06A9\u062A\u0631 \u062D\u0633\u06CC\u0646\u06CC");
  const [email, setEmail] = useState("dr.hosseini@example.com");
  const { theme: currentTheme, resolvedTheme, setTheme: setNextTheme } = useTheme();
  const theme = (currentTheme ?? "system") as Theme;
  const setTheme = (t: Theme) => setNextTheme(t);
  const c = getTokens(resolvedTheme === "dark");
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  const handleSave = () => {
    toast.success("\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F");
  };

  const themeOptions: { value: Theme; label: string; icon: React.ElementType }[] = [
    { value: "light", label: "\u0631\u0648\u0634\u0646", icon: Sun },
    { value: "dark", label: "\u062A\u0627\u0631\u06CC\u06A9", icon: Moon },
    { value: "system", label: "\u0633\u06CC\u0633\u062A\u0645", icon: Monitor },
  ];

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "right-0.5" : "right-[22px]"}`} />
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader badge="SETTINGS" breadcrumb={[{ label: "\u062E\u0627\u0646\u0647", href: "/" }, { label: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A" }]} title={"\u062A\u0646\u0638\u06CC\u0645\u0627\u062A"} description={"\u0645\u062F\u06CC\u0631\u06CC\u062A \u062D\u0633\u0627\u0628 \u0648 \u062A\u0631\u062C\u06CC\u062D\u0627\u062A"} />

      {/* Profile */}
      <Surface padding="md" radius="xl">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <User className="h-5 w-5" style={{ color: c.accent }} />
          {"\u067E\u0631\u0648\u0641\u0627\u06CC\u0644"}
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold">{"\u0646\u0627\u0645"}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold">{"\u0627\u06CC\u0645\u06CC\u0644"}</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
          </div>
        </div>
      </Surface>

      {/* Appearance */}
      <Surface padding="md" radius="xl">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5" style={{ color: c.accent }} />
            {"\u0638\u0627\u0647\u0631"}
        </h3>
          <div className="flex gap-3">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  theme === opt.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/50 hover:border-border opacity-60"
                }`}
              >
                <opt.icon className="h-5 w-5" />
                <span className="text-sm font-bold">{opt.label}</span>
              </button>
            ))}
          </div>
      </Surface>

      {/* Preferences */}
      <Surface padding="md" radius="xl">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5" style={{ color: c.accent }} />
            {"\u062A\u0631\u062C\u06CC\u062D\u0627\u062A"}
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: c.surfaceSubtle }}>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="text-sm font-bold">{"\u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627"}</span>
            </div>
            <Toggle checked={notifications} onChange={setNotifications} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: c.surfaceSubtle }}>
            <div className="flex items-center gap-2">
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="text-sm font-bold">{"\u0635\u062F\u0627"}</span>
            </div>
            <Toggle checked={sound} onChange={setSound} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: c.surfaceSubtle }}>
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              <span className="text-sm font-bold">{"\u0630\u062E\u06CC\u0631\u0647 \u062E\u0648\u062F\u06A9\u0627\u0631"}</span>
            </div>
            <Toggle checked={autoSave} onChange={setAutoSave} />
          </div>
        </div>
      </Surface>

      {/* Data */}
      <Surface padding="md" radius="xl">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <Database className="h-5 w-5" style={{ color: c.accent }} />
            {"\u062F\u0627\u062F\u0647\u200C\u0647\u0627"}
        </h3>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-1.5">
            <Download className="h-4 w-4" />
            {"\u062E\u0631\u0648\u062C\u06CC \u062F\u0627\u062F\u0647\u200C\u0647\u0627"}
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleReset}
            disabled={resetting}
          >
            <Trash2 className="h-4 w-4" />
            {resetting ? "\u062F\u0631 \u062D\u0627\u0644 \u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC..." : "\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u062F\u0627\u062F\u0647\u200C\u0647\u0627"}
          </Button>
        </div>
      </Surface>

      {/* Session */}
      <Surface padding="md" radius="xl">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5" style={{ color: c.accent }} />
          {"\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC"}
        </h3>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {"\u062E\u0631\u0648\u062C \u0627\u0632 \u062D\u0633\u0627\u0628 \u0648 \u0642\u0641\u0644 \u06A9\u0631\u062F\u0646 \u0627\u06CC\u0646 \u0645\u0631\u0648\u0631\u06AF\u0631"}
          </div>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut className="h-4 w-4" />
            {loggingOut
              ? "\u062F\u0631 \u062D\u0627\u0644 \u062E\u0631\u0648\u062C\u2026"
              : "\u062E\u0631\u0648\u062C"}
          </Button>
        </div>
      </Surface>

      {/* Save */}
      <div className="flex justify-end pb-6">
        <Button size="lg" onClick={handleSave} className="gap-2 px-8 shadow-xl">
          <Save className="h-5 w-5" />
          {"\u0630\u062E\u06CC\u0631\u0647 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A"}
        </Button>
      </div>
    </div>
  );
}