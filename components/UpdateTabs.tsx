"use client";

import { useState } from "react";
import Link from "next/link";
import EntryForms from "./EntryForms";
import SettingsForm, { type Settings } from "./SettingsForm";
import Footer from "./Footer";
import type { MonthlyRow, WeeklyRow } from "@/lib/calc";

type Tab = "weekly" | "monthly" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "weekly", label: "Weekly numbers" },
  { id: "monthly", label: "Monthly numbers" },
  { id: "settings", label: "Vision, values, targets" },
];

export default function UpdateTabs({ settings, weekly, monthly, today, email }: { settings: Settings; weekly: WeeklyRow[]; monthly: MonthlyRow[]; today: string; email: string }) {
  const [tab, setTab] = useState<Tab>("weekly");
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>Update numbers</h1>
          <p className="muted small">{email} <span className="badge">Editor</span></p>
        </div>
        <nav className="nav"><Link className="btn ghost" href="/">Back to dashboard</Link></nav>
      </header>

      <div>
        <div className="seg" role="tablist" aria-label="What to update" style={{ marginBottom: 24 }}>
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-pressed={tab === t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <section className="card">
          {tab === "settings" ? (
            <SettingsForm settings={settings} currentYear={Number(today.slice(0, 4))} />
          ) : (
            <EntryForms key={tab} mode={tab} weekly={weekly} monthly={monthly} today={today} />
          )}
        </section>
      </div>

      <Footer values={settings.core_values} />
    </div>
  );
}
