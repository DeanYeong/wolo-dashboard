"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type ValueItem = { t: string; d: string };
export type Settings = {
  vision: string;
  core_values: ValueItem[];
  target_2027: number | null; // annual revenue target amount (column name is historical)
  target_year: number | null; // year the target applies to; null means the current year
  fee_rate: number;
};

const pad = (v: ValueItem[]) => Array.from({ length: 4 }, (_, i) => v[i] ?? { t: "", d: "" });

// Vision, core values, the annual target and the fee estimate. Lives on the Update page, never on the dashboard.
export default function SettingsForm({ settings, currentYear }: { settings: Settings; currentYear: number }) {
  const router = useRouter();
  const [vision, setVision] = useState(settings.vision);
  const [values, setValues] = useState(pad(settings.core_values));
  const [target, setTarget] = useState(settings.target_2027 ? String(settings.target_2027) : "");
  const [year, setYear] = useState(settings.target_year ? String(settings.target_year) : "");
  const [fee, setFee] = useState(String(Math.round(settings.fee_rate * 1000) / 10));
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const feeNum = Number(fee);
    if (!(feeNum >= 0 && feeNum < 100)) { setStatus({ ok: false, msg: "Fee estimate must be between 0 and 100%." }); return; }
    const yearNum = year.trim() ? Number(year.trim()) : null;
    if (yearNum !== null && !(Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100)) {
      setStatus({ ok: false, msg: "Target year must be a year like 2027, or blank for the current year." });
      return;
    }
    const targetNum = Number(target.replace(/[^0-9.]/g, ""));
    setBusy(true);
    const { error } = await createClient()
      .from("settings")
      .update({
        vision,
        core_values: values,
        target_2027: target.trim() && targetNum > 0 ? targetNum : null,
        target_year: yearNum,
        fee_rate: feeNum / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setBusy(false);
    if (error) {
      const needsSql = error.message.includes("target_year");
      setStatus({
        ok: false,
        msg: needsSql
          ? "Could not save: the database needs one update. Run supabase/migrations/20261028_target_year.sql in the Supabase SQL editor, then save again."
          : `Could not save: ${error.message}`,
      });
    } else {
      setStatus({ ok: true, msg: "Saved." });
      router.refresh();
    }
  }

  return (
    <form onSubmit={save}>
      <h2 className="section-title">Vision, values and targets</h2>
      <p className="lead">The vision and target appear on the dashboard. Core values appear in the footer of every page.</p>

      <label>3-year vision (display only, not tracked)
        <textarea className="vision-input" value={vision} onChange={(e) => setVision(e.target.value)}
          placeholder="Where is Wolo Yoga in three years? Write it as a sentence you would be proud to say out loud." />
      </label>

      <p className="eyebrow" style={{ marginTop: 32 }}>Core values</p>
      <div className="grid4">
        {values.map((v, i) => (
          <div className="val-edit" key={i}>
            <input value={v.t} aria-label={`Value ${i + 1}`} placeholder={`Value ${i + 1}${i === 3 ? " (optional)" : ""}`}
              onChange={(e) => setValues(values.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))} />
            <textarea value={v.d} aria-label={`Value ${i + 1} meaning`} placeholder="What it means, and what it looks like in a week"
              onChange={(e) => setValues(values.map((x, j) => (j === i ? { ...x, d: e.target.value } : x)))} />
          </div>
        ))}
      </div>

      <p className="eyebrow" style={{ marginTop: 32 }}>Annual revenue target</p>
      <div className="fields">
        <label>Target year
          <input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder={`${currentYear} (blank = current year)`} />
        </label>
        <label>Total revenue target for that year (RM)
          <input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 1200000" />
        </label>
        <label>Merchant and platform fee estimate (% of revenue)
          <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
      </div>
      <p className="muted small" style={{ margin: "10px 0 0" }}>
        Progress adds up the monthly entries in the target year. The fee rate is an estimate used in total contribution margin; changing it restates every period, past ones included.
      </p>

      <div className="form-foot">
        <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        {status && (
          <p className={status.ok ? "ok" : "err"} role="status">
            {status.msg} {status.ok && <Link href="/">View dashboard</Link>}
          </p>
        )}
      </div>
    </form>
  );
}
