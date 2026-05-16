"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import type { ReaderFontFamily, ReaderSettings, ReaderBgTheme, ReaderToolbarStyle } from "@/hooks/useReaderSettings";
import { BG_THEMES } from "@/hooks/useReaderSettings";
import { cn } from "@/lib/utils";

type ReaderDisplaySettingsProps = {
  settings: ReaderSettings;
  onUpdate: (patch: Partial<ReaderSettings>) => void;
  className?: string;
};

const FONT_OPTIONS: Array<{ value: ReaderFontFamily; label: string; caption: string }> = [
  { value: "sans",  label: "سنس",  caption: "خواندن فارسی" },
  { value: "serif", label: "سریف", caption: "متن کلاسیک" },
  { value: "mono",  label: "مونو", caption: "اعداد/کد" },
];

const FONT_SIZE_PRESETS = [16, 20, 24, 32, 40];
const LINE_HEIGHT_PRESETS = [1.6, 1.8, 2.0];
const WIDTH_PRESETS = [720, 1000, 1280, 1600];
const WIDTH_FULL = 1800;
const WIDTH_MIN = 540;
const WIDTH_MAX = 1800;

const TOOLBAR_STYLE_OPTIONS: Array<{ value: ReaderToolbarStyle; label: string; caption: string }> = [
  { value: "popup", label: "پاپ‌آپ", caption: "نمایش پس از انتخاب" },
  { value: "rail",  label: "ریل",   caption: "نوار ثابت GoodNotes" },
  { value: "both",  label: "هر دو", caption: "ریل + پاپ‌آپ" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-lib-text-muted">{title}</div>
      {children}
    </section>
  );
}

function SegmentButton({
  active, children, onClick, title,
}: {
  active: boolean; children: React.ReactNode; onClick: () => void; title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "min-h-11 flex-1 rounded-lib-sm px-3 py-2 text-center text-xs transition",
        "border border-transparent hover:bg-lib-hover",
        active ? "bg-lib-accent/10 text-lib-accent ring-1 ring-lib-accent/25" : "text-lib-text-secondary",
      )}
    >
      {children}
    </button>
  );
}

function Stepper({ value, label, onMinus, onPlus }: {
  value: React.ReactNode; label: string; onMinus: () => void; onPlus: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lib-sm border border-lib-border bg-lib-surface p-1">
      <button
        type="button"
        onClick={onMinus}
        className="flex h-11 w-11 items-center justify-center rounded-lib-sm text-base text-lib-text-secondary hover:bg-lib-hover"
        aria-label={`${label}: decrease`}
      >−</button>
      <div className="min-w-[72px] flex-1 text-center">
        <div className="text-sm font-semibold tabular-nums text-lib-text">{value}</div>
        <div className="text-[10px] text-lib-text-muted">{label}</div>
      </div>
      <button
        type="button"
        onClick={onPlus}
        className="flex h-11 w-11 items-center justify-center rounded-lib-sm text-base text-lib-text-secondary hover:bg-lib-hover"
        aria-label={`${label}: increase`}
      >+</button>
    </div>
  );
}

function BgSwatchButton({
  config, active, onClick,
}: {
  config: typeof BG_THEMES[0];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={config.label}
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all",
        active
          ? "ring-2 ring-lib-accent ring-offset-1 ring-offset-lib-panel"
          : "hover:bg-lib-hover",
      )}
    >
      <span
        className="h-9 w-9 rounded-full border-2 shadow-inner transition-transform group-hover:scale-105"
        style={{
          backgroundColor: config.swatch,
          borderColor: active ? "hsl(var(--lib-accent))" : "rgba(0,0,0,0.12)",
        }}
      />
      <span className={cn(
        "text-[10px] leading-none",
        active ? "font-semibold text-lib-accent" : "text-lib-text-muted",
      )}>
        {config.label}
      </span>
    </button>
  );
}

export function ReaderDisplaySettings({
  settings,
  onUpdate,
  className,
}: ReaderDisplaySettingsProps) {
  const { setTheme } = useTheme();

  const handleBgTheme = (id: ReaderBgTheme) => {
    onUpdate({ bgTheme: id });
    const cfg = BG_THEMES.find((t) => t.id === id);
    if (cfg) setTheme(cfg.isDark ? "dark" : "light");
  };

  const lightThemes = useMemo(() => BG_THEMES.filter((t) => !t.isDark), []);
  const darkThemes  = useMemo(() => BG_THEMES.filter((t) => t.isDark), []);

  return (
    <div
      dir="rtl"
      className={cn(
        "w-full max-w-[400px] rounded-2xl border border-lib-border bg-lib-panel/95 p-4 shadow-xl backdrop-blur",
        "space-y-5 text-right",
        className,
      )}
    >
      {/* ── Background theme ── */}
      <Section title="پس‌زمینه خواندن">
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-lib-text-muted/80">روشن</span>
            <div className="flex flex-1 justify-around">
              {lightThemes.map((cfg) => (
                <BgSwatchButton
                  key={cfg.id}
                  config={cfg}
                  active={settings.bgTheme === cfg.id}
                  onClick={() => handleBgTheme(cfg.id)}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-lib-text-muted/80">تیره</span>
            <div className="flex flex-1 justify-around">
              {darkThemes.map((cfg) => (
                <BgSwatchButton
                  key={cfg.id}
                  config={cfg}
                  active={settings.bgTheme === cfg.id}
                  onClick={() => handleBgTheme(cfg.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Toolbar style ── */}
      <Section title="سبک ابزار حاشیه‌نویسی">
        <div className="grid grid-cols-3 gap-1 rounded-lib-sm bg-lib-surface p-1">
          {TOOLBAR_STYLE_OPTIONS.map((opt) => (
            <SegmentButton
              key={opt.value}
              active={settings.toolbarStyle === opt.value}
              onClick={() => onUpdate({ toolbarStyle: opt.value })}
              title={opt.caption}
            >
              <span className="block text-sm font-semibold">{opt.label}</span>
              <span className="mt-0.5 block text-[9px] opacity-70">{opt.caption}</span>
            </SegmentButton>
          ))}
        </div>
      </Section>

      <div className="h-px bg-lib-border/50" />

      {/* ── Font ── */}
      <Section title="قلم">
        <div className="grid grid-cols-3 gap-1 rounded-lib-sm bg-lib-surface p-1">
          {FONT_OPTIONS.map((option) => (
            <SegmentButton
              key={option.value}
              active={settings.fontFamily === option.value}
              onClick={() => onUpdate({ fontFamily: option.value })}
              title={option.caption}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-[10px] opacity-70">{option.caption}</span>
            </SegmentButton>
          ))}
        </div>
      </Section>

      {/* ── Font size ── */}
      <Section title="اندازه متن">
        <Stepper
          label="px"
          value={settings.fontSize}
          onMinus={() => onUpdate({ fontSize: clamp(settings.fontSize - 1, 13, 40) })}
          onPlus={() => onUpdate({ fontSize: clamp(settings.fontSize + 1, 13, 40) })}
        />
        <div className="grid grid-cols-5 gap-1">
          {FONT_SIZE_PRESETS.map((size) => (
            <SegmentButton key={size} active={settings.fontSize === size} onClick={() => onUpdate({ fontSize: size })}>
              {size}
            </SegmentButton>
          ))}
        </div>
      </Section>

      {/* ── Line height ── */}
      <Section title="فاصله سطر">
        <Stepper
          label="line"
          value={settings.lineHeight.toFixed(1)}
          onMinus={() => onUpdate({ lineHeight: clamp(Number((settings.lineHeight - 0.1).toFixed(1)), 1.4, 2.2) })}
          onPlus={() => onUpdate({ lineHeight: clamp(Number((settings.lineHeight + 0.1).toFixed(1)), 1.4, 2.2) })}
        />
        <div className="grid grid-cols-3 gap-1">
          {LINE_HEIGHT_PRESETS.map((lh) => (
            <SegmentButton key={lh} active={settings.lineHeight === lh} onClick={() => onUpdate({ lineHeight: lh })}>
              {lh.toFixed(1)}
            </SegmentButton>
          ))}
        </div>
      </Section>

      {/* ── Column width ── */}
      <Section title="عرض ستون">
        <Stepper
          label={settings.maxWidth >= WIDTH_FULL ? "تمام صفحه" : "px"}
          value={settings.maxWidth >= WIDTH_FULL ? "تمام" : settings.maxWidth}
          onMinus={() => onUpdate({ maxWidth: clamp(settings.maxWidth >= WIDTH_FULL ? 1600 : settings.maxWidth - 80, WIDTH_MIN, WIDTH_MAX) })}
          onPlus={() => onUpdate({ maxWidth: clamp(settings.maxWidth + 80, WIDTH_MIN, WIDTH_MAX) })}
        />
        <div className="grid grid-cols-5 gap-1">
          {WIDTH_PRESETS.map((width) => (
            <SegmentButton key={width} active={settings.maxWidth === width} onClick={() => onUpdate({ maxWidth: width })}>
              {width}
            </SegmentButton>
          ))}
          <SegmentButton active={settings.maxWidth >= WIDTH_FULL} onClick={() => onUpdate({ maxWidth: WIDTH_FULL })} title="تمام عرض صفحه">
            تمام
          </SegmentButton>
        </div>
      </Section>
    </div>
  );
}
