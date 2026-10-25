"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mondayOf, monthStartOf, weekLabel, addDays, FLOW_KEYS, type FlowKey, type MonthlyRow, type WeeklyRow } from "@/lib/calc";

const LABELS: Record<FlowKey, string> = {
  shopify_revenue: "Shopify revenue",
  shopee_revenue: "Shopee revenue",
  other_revenue: "Other revenue",
  shopify_cogs: "Shopify COGS",
  shopee_cogs: "Shopee COGS",
  other_cogs: "Other revenue COGS",
  meta_spend: "Meta ad spend",
  google_spend: "Google ad spend",
  shopee_ads: "Shopee ad spend",
  affiliate: "Affiliate commission",
};
const GROUPS: { title: string; keys: FlowKey[]; monthlyOnly?: boolean }[] = [
  { title: "Revenue (RM)", keys: ["shopify_revenue", "shopee_revenue", "other_revenue"] },
  { title: "COGS (RM)", keys: ["shopify_cogs", "shopee_cogs", "other_cogs"] },
  { title: "Ad spend and commission (RM)", keys: ["meta_spend", "google_spend", "shopee_ads", "affiliate"] },
];
const WEEKLY_KEYS: readonly FlowKey[] = FLOW_KEYS.filter((k) => k !== "other_revenue" && k !== "other_cogs");

const toStr = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function EntryForms({ mode, weekly, monthly, today }: { mode: "weekly" | "monthly"; weekly: WeeklyRow[]; monthly: MonthlyRow[]; today: string }) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(addDays(mondayOf(today), -7)); // default: last finished week
  const [monthStart, setMonthStart] = useState(monthStartOf(addDays(monthStartOf(today), -1))); // default: last finished month
  const [form, setForm] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const key = mode === "weekly" ? weekStart : monthStart;
  const existing = useMemo(
    () => (mode === "weekly" ? weekly.find((r) => r.week_start === weekStart) : monthly.find((r) => r.month_start === monthStart)) as
      (Partial<Record<FlowKey, number>> & { ccc_days?: number | null; cash_in_bank?: number | null }) | undefined,
    [mode, weekStart, monthStart, weekly, monthly],
  );

  // Fill the form from the saved entry whenever the period (or the saved data) changes.
  const [loadedFor, setLoadedFor] = useState("");
  const sig = `${mode}|${key}|${existing ? "y" : "n"}|${existing ? JSON.stringify(existing) : ""}`;
  if (sig !== loadedFor) {
    setLoadedFor(sig);
    const f: Record<string, string> = {};
    FLOW_KEYS.forEach((k) => (f[k] = toStr(existing?.[k])));
    f.ccc_days = toStr(existing?.ccc_days);
    f.cash_in_bank = toStr(existing?.cash_in_bank);
    setForm(f);
  }

  const visible = (k: FlowKey) => mode === "monthly" || WEEKLY_KEYS.includes(k);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const flows = Object.fromEntries(FLOW_KEYS.filter(visible).map((k) => [k, Number(form[k] || 0)]));
    if (Object.values(flows).some((v) => !Number.isFinite(v) || v < 0)) {
      setBusy(false);
      setStatus({ ok: false, msg: "Amounts must be numbers of 0 or more." });
      return;
    }
    const base = { ...flows, updated_at: new Date().toISOString() };
    const supabase = createClient();
    const { error } =
      mode === "weekly"
        ? await supabase.from("weekly_entries").upsert({ week_start: weekStart, ...base })
        : await supabase.from("monthly_entries").upsert({
            month_start: monthStart,
            ...base,
            ccc_days: form.ccc_days === "" ? null : Number(form.ccc_days),
            cash_in_bank: form.cash_in_bank === "" ? null : Number(form.cash_in_bank),
          });
    setBusy(false);
    if (error) setStatus({ ok: false, msg: `Could not save: ${error.message}` });
    else { setStatus({ ok: true, msg: `${mode === "weekly" ? "Week of " + weekLabel(weekStart) : monthStart.slice(0, 7)} ${existing ? "updated" : "saved"}.` }); router.refresh(); }
  }

  return (
    <>
      <h2 className="section-title">{mode === "weekly" ? "Weekly numbers" : "Monthly numbers"}</h2>
      <p className="lead">{mode === "weekly" ? "One entry per week, Monday to Sunday. Shopify and Shopee only." : "One entry per calendar month. This is the official record that quarters and years add up."}</p>
      <form onSubmit={save}>
        <div className="row" style={{ marginBottom: 20, alignItems: "flex-end" }}>
          {mode === "weekly" ? (
            <label style={{ width: 220 }}>Any date in the week
              <input type="date" value={weekStart} onChange={(e) => e.target.value && setWeekStart(mondayOf(e.target.value))} />
            </label>
          ) : (
            <label style={{ width: 220 }}>Month
              <input type="month" value={monthStart.slice(0, 7)} onChange={(e) => e.target.value && setMonthStart(e.target.value + "-01")} />
            </label>
          )}
          <p className="muted small" style={{ margin: 0 }}>
            {mode === "weekly" ? `Week of ${weekLabel(weekStart)} to ${weekLabel(addDays(weekStart, 6))} (Mon to Sun).` : "Calendar month."}{" "}
            {existing ? "An entry exists; saving replaces it." : "No entry yet."}
          </p>
        </div>
        <div className="fields">
          {GROUPS.map((g) => (
            <FieldGroup key={g.title} title={g.title}>
              {g.keys.filter(visible).map((k) => (
                <label key={k}>{LABELS[k]}
                  <input inputMode="decimal" value={form[k] ?? ""} placeholder="0" onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </label>
              ))}
            </FieldGroup>
          ))}
          {mode === "monthly" && (
            <FieldGroup title="Cash (monthly only)">
              <label>Cash conversion cycle (days)
                <input inputMode="decimal" value={form.ccc_days ?? ""} onChange={(e) => setForm({ ...form, ccc_days: e.target.value })} />
              </label>
              <label>Cash in bank at month end (RM)
                <input inputMode="decimal" value={form.cash_in_bank ?? ""} onChange={(e) => setForm({ ...form, cash_in_bank: e.target.value })} />
              </label>
            </FieldGroup>
          )}
        </div>
        <div className="form-foot">
          <button className="btn" disabled={busy}>{busy ? "Saving…" : existing ? "Save changes" : "Save entry"}</button>
          {status && (
            <p className={status.ok ? "ok" : "err"} role="status">
              {status.msg} {status.ok && <Link href="/">View dashboard</Link>}
            </p>
          )}
        </div>
      </form>
    </>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h3>{title}</h3>
      {children}
    </>
  );
}
