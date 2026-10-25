"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type ValueItem = { t: string; d: string };
export type Settings = { vision: string; core_values: ValueItem[]; target_2027: number | null; fee_rate: number };

const pad = (v: ValueItem[]) => Array.from({ length: 4 }, (_, i) => v[i] ?? { t: "", d: "" });

// Vision, core values, the 2027 target and the fee estimate. Editors can change them; viewers see them read-only.
export default function SettingsPanel({ settings, canEdit, children }: { settings: Settings; canEdit: boolean; children?: React.ReactNode }) {
  const router = useRouter();
  const [vision, setVision] = useState(settings.vision);
  const [values, setValues] = useState(pad(settings.core_values));
  const [target, setTarget] = useState(settings.target_2027 ? String(settings.target_2027) : "");
  const [fee, setFee] = useState(String(Math.round(settings.fee_rate * 1000) / 10));
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const feeNum = Number(fee);
    if (!(feeNum >= 0 && feeNum < 100)) { setStatus({ ok: false, msg: "Fee estimate must be between 0 and 100%." }); return; }
    setBusy(true);
    const targetNum = Number(target.replace(/[^0-9.]/g, ""));
    const { error } = await createClient()
      .from("settings")
      .update({
        vision,
        core_values: values,
        target_2027: target.trim() && targetNum > 0 ? targetNum : null,
        fee_rate: feeNum / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setBusy(false);
    if (error) setStatus({ ok: false, msg: `Could not save: ${error.message}` });
    else { setStatus({ ok: true, msg: "Saved" }); router.refresh(); }
  }

  const ro = !canEdit;
  return (
    <>
      <section className="card" id="vision">
        <p className="eyebrow">3-year vision · not tracked</p>
        <textarea className="vision" readOnly={ro} value={vision} onChange={(e) => setVision(e.target.value)} aria-label="3-year vision"
          placeholder={ro ? "" : "Where is Wolo Yoga in three years? Write it as a sentence you would be proud to say out loud."} />
      </section>

      <section className="card" id="values">
        <p className="eyebrow">Core values</p>
        <div className="grid4">
          {values.map((v, i) => (
            <div className="val" key={i}>
              <input readOnly={ro} value={v.t} aria-label={`Value ${i + 1}`} placeholder={ro ? "" : `Value ${i + 1}${i === 3 ? " (optional)" : ""}`}
                onChange={(e) => setValues(values.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))} />
              <textarea readOnly={ro} value={v.d} aria-label={`Value ${i + 1} meaning`} placeholder={ro ? "" : "What it means, and what it looks like in a week"}
                onChange={(e) => setValues(values.map((x, j) => (j === i ? { ...x, d: e.target.value } : x)))} />
            </div>
          ))}
        </div>
      </section>

      {children /* the 2027 target card sits between, and needs the saved target */}

      {canEdit && (
        <section className="card" id="settings">
          <p className="eyebrow">Targets and assumptions</p>
          <div className="row">
            <label style={{ width: 240 }}>2027 total revenue target (RM)
              <input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 1200000" />
            </label>
            <label style={{ width: 240 }}>Merchant and platform fee estimate (% of revenue)
              <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
            </label>
            <button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save vision, values and targets"}</button>
          </div>
          <p className="muted small" style={{ margin: "8px 0 0" }}>
            The fee rate is an estimate used in total contribution margin. Changing it restates every period, past ones included.
          </p>
          {status && <p className={status.ok ? "ok" : "err"} role="status">{status.msg}</p>}
        </section>
      )}
    </>
  );
}
