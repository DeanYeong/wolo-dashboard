"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Target } from "@/lib/calc";

export type ValueItem = { t: string; d: string };
export type Settings = { vision: string; core_values: ValueItem[]; fee_rate: number };

type Row = { id: string; year: string; amount: string; saved: boolean };

const pad = (v: ValueItem[]) => Array.from({ length: 4 }, (_, i) => v[i] ?? { t: "", d: "" });
const toRows = (t: Target[]): Row[] => [...t].sort((a, b) => a.year - b.year).map((x) => ({ id: `y${x.year}`, year: String(x.year), amount: String(x.amount), saved: true }));
const MIGRATION = "supabase/migrations/20261028_annual_targets.sql";

// Vision, core values, yearly targets and the fee estimate. Lives on the Update page, never on the dashboard.
export default function SettingsForm({ settings, targets, targetsReady, currentYear }: { settings: Settings; targets: Target[]; targetsReady: boolean; currentYear: number }) {
  const router = useRouter();
  const counter = useRef(0);
  const [vision, setVision] = useState(settings.vision);
  const [values, setValues] = useState(pad(settings.core_values));
  const [rows, setRows] = useState<Row[]>(toRows(targets));
  const [fee, setFee] = useState(String(Math.round(settings.fee_rate * 1000) / 10));
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const setRow = (id: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  function addRow() {
    const years = rows.map((r) => Number(r.year)).filter((y) => Number.isInteger(y));
    const next = years.length ? Math.max(...years, currentYear - 1) + 1 : currentYear;
    setRows([...rows, { id: `n${counter.current++}`, year: String(next), amount: "", saved: false }]);
  }

  async function remove(r: Row) {
    if (!r.saved) { setRows(rows.filter((x) => x.id !== r.id)); return; }
    if (!window.confirm(`Remove the ${r.year} target? It will be deleted from your history.`)) return;
    const { error } = await createClient().from("annual_targets").delete().eq("year", Number(r.year));
    if (error) setStatus({ ok: false, msg: `Could not remove: ${error.message}` });
    else { setRows(rows.filter((x) => x.id !== r.id)); setStatus({ ok: true, msg: `${r.year} target removed.` }); router.refresh(); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const feeNum = Number(fee);
    if (!(feeNum >= 0 && feeNum < 100)) { setStatus({ ok: false, msg: "Fee estimate must be between 0 and 100%." }); return; }

    const clean: { year: number; amount: number }[] = [];
    const seen = new Set<number>();
    for (const r of rows) {
      if (!r.year.trim() && !r.amount.trim()) continue;
      const y = Number(r.year.trim());
      const a = Number(r.amount.replace(/[^0-9.]/g, ""));
      if (!(Number.isInteger(y) && y >= 2000 && y <= 2100)) { setStatus({ ok: false, msg: "Each target needs a year like 2027." }); return; }
      if (!(a > 0)) { setStatus({ ok: false, msg: `Enter the ${y} revenue target, or remove that row.` }); return; }
      if (seen.has(y)) { setStatus({ ok: false, msg: `${y} appears twice. Edit the existing ${y} row instead.` }); return; }
      seen.add(y);
      clean.push({ year: y, amount: a });
    }

    setBusy(true);
    const supabase = createClient();
    const s = await supabase
      .from("settings")
      .update({ vision, core_values: values, fee_rate: feeNum / 100, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (s.error) { setBusy(false); setStatus({ ok: false, msg: `Could not save: ${s.error.message}` }); return; }

    if (targetsReady && clean.length) {
      const t = await supabase
        .from("annual_targets")
        .upsert(clean.map((c) => ({ ...c, updated_at: new Date().toISOString() })), { onConflict: "year" });
      if (t.error) { setBusy(false); setStatus({ ok: false, msg: `Saved everything except the targets: ${t.error.message}` }); return; }
      setRows(toRows(clean));
    }
    setBusy(false);
    setStatus({ ok: true, msg: "Saved." });
    router.refresh();
  }

  return (
    <form onSubmit={save}>
      <h2 className="section-title">Vision, values and targets</h2>
      <p className="lead">The vision and targets appear on the dashboard. Core values appear in the footer of every page.</p>

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

      <p className="eyebrow" style={{ marginTop: 32 }}>Annual revenue targets</p>
      {!targetsReady ? (
        <p className="banner">Yearly targets need a one-time database update. Run <code>{MIGRATION}</code> in the Supabase SQL editor, then reload. Your existing target keeps working until then.</p>
      ) : (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>One target per year. Adding a new year keeps the earlier ones, and the dashboard lets you switch between them.</p>
          {rows.map((r) => (
            <div className="target-row" key={r.id}>
              <label>Year
                <input inputMode="numeric" value={r.year} readOnly={r.saved} aria-label="Target year" onChange={(e) => setRow(r.id, { year: e.target.value })} />
              </label>
              <label>Total revenue target (RM)
                <input inputMode="numeric" value={r.amount} placeholder="e.g. 1200000" aria-label={`Revenue target for ${r.year}`} onChange={(e) => setRow(r.id, { amount: e.target.value })} />
              </label>
              <button type="button" className="btn ghost small-btn" onClick={() => remove(r)}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn ghost small-btn" onClick={addRow}>+ Add a year</button>
        </>
      )}

      <p className="eyebrow" style={{ marginTop: 32 }}>Assumptions</p>
      <div className="fields">
        <label>Merchant and platform fee estimate (% of revenue)
          <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
      </div>
      <p className="muted small" style={{ margin: "10px 0 0" }}>
        Used in total contribution margin. Changing it restates every period, past ones included.
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
