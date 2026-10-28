"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BarChart from "./BarChart";
import Footer from "./Footer";
import type { Settings } from "./SettingsForm";
import { buildPeriods, derive, missingCompleted, paceShare, yearToDate, type MonthlyRow, type Period, type View, type WeeklyRow } from "@/lib/calc";
import { days, pct, rm, share, times } from "@/lib/format";

type Props = { role: "editor" | "viewer"; email: string; settings: Settings; weekly: WeeklyRow[]; monthly: MonthlyRow[]; today: string };

type Tile = {
  id: string;
  title: string;
  short: string; // compact name for the table header
  note: string;
  monthlyOnly?: boolean;
  lowerIsBetter?: boolean;
  get: (p: Period, fee: number) => number | null;
  fmt: (v: number | null) => string;
  delta: "pct" | "abs";
};

const TILES: Tile[] = [
  { id: "shopify", title: "Shopify revenue", short: "Shopify", note: "Total sales", get: (p) => p.flows?.shopify_revenue ?? null, fmt: rm, delta: "pct" },
  { id: "shopee", title: "Shopee revenue", short: "Shopee", note: "Total sales", get: (p) => p.flows?.shopee_revenue ?? null, fmt: rm, delta: "pct" },
  {
    id: "shopifyGp", title: "Shopify gross profit / ad spend", short: "Shopify GP / Adspend", note: "Gross profit ÷ (Meta + Google + affiliate)",
    get: (p, fee) => (p.flows ? derive(p.flows, fee).shopifyGpPerAd : null), fmt: times, delta: "pct",
  },
  {
    id: "shopeeGp", title: "Shopee gross profit / ad spend", short: "Shopee GP / Adspend", note: "Gross profit ÷ Shopee ads",
    get: (p, fee) => (p.flows ? derive(p.flows, fee).shopeeGpPerAd : null), fmt: times, delta: "pct",
  },
  {
    id: "cm", title: "Total contribution margin (est.)", short: "Total CM", note: "Revenue less est. fees, COGS, ads and commission",
    get: (p, fee) => (p.flows ? derive(p.flows, fee).contribution : null), fmt: rm, delta: "pct",
  },
  { id: "ccc", title: "Cash conversion cycle", short: "CCC", note: "Days, latest month", monthlyOnly: true, lowerIsBetter: true, get: (p) => p.ccc, fmt: days, delta: "abs" },
  { id: "cash", title: "Cash in bank, end of month", short: "EOM Cash", note: "Latest month end", monthlyOnly: true, get: (p) => p.cash, fmt: rm, delta: "pct" },
];

const VIEWS: { id: View; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
];

// Read-only for everyone. Numbers are entered on /update, which only editors can open.
export default function Dashboard({ role, email, settings, weekly, monthly, today }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("monthly");
  const fee = settings.fee_rate;
  const canEdit = role === "editor";
  const periods = buildPeriods(view, weekly, monthly, today);
  const missing = missingCompleted(view, periods, today);
  const entered = periods.filter((p) => p.entered);
  const latest = entered[entered.length - 1];
  const previous = entered[entered.length - 2];

  const thisYear = Number(today.slice(0, 4));
  const year = settings.target_year ?? thisYear; // blank target year means the current year
  const ytd = yearToDate(monthly, year);
  const target = settings.target_2027; // annual revenue target (column name is historical)
  const progress = target ? ytd / target : null;
  const pace = paceShare(today, year);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const partial = (p: Period) => p.monthsIn < p.monthsExpected && (view === "quarterly" || view === "yearly");
  const unit = view === "weekly" ? "week" : view === "monthly" ? "month" : view === "quarterly" ? "quarter" : "year";

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>Wolo Yoga</h1>
          <p className="muted small">{email}<span className="badge">{canEdit ? "Editor" : "View only"}</span></p>
        </div>
        <nav className="nav">
          {canEdit && <Link className="btn" href="/update">Update numbers</Link>}
          <button className="btn ghost" onClick={signOut}>Sign out</button>
        </nav>
      </header>

      <section aria-label="3-year vision">
        <p className="eyebrow">3-year vision</p>
        {settings.vision.trim() ? (
          <p className="vision-text">{settings.vision}</p>
        ) : (
          <p className="empty">Not written yet.{canEdit && <> <Link href="/update">Add it</Link></>}</p>
        )}
      </section>

      <section className="card" id="target">
        <p className="eyebrow">{year} target · total revenue (Shopify + Shopee + other)</p>
        <div className="row">
          <div className="stat"><div className="l">Revenue so far in {year}</div><div className="v">{rm(ytd)}</div></div>
          <div className="stat"><div className="l">Target</div><div className="v">{target ? rm(target) : "Not set"}</div></div>
          <div className="stat"><div className="l">Share of target</div><div className="v">{share(progress)}</div></div>
        </div>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, (progress ?? 0) * 100)}%` }} />
          {pace !== null && <b style={{ left: `${pace * 100}%` }} />}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {pace !== null ? "The black line is where an even pace would be today." : year > thisYear ? `Tracking starts on 1 Jan ${year}, summed from monthly entries.` : `${year} has ended. The total is the sum of its monthly entries.`}
        </p>
      </section>

      <section className="card" id="metrics">
        <div className="top" style={{ marginBottom: 24 }}>
          <p className="eyebrow" style={{ margin: 0 }}>Key metrics</p>
          <div className="seg" role="group" aria-label="Period">
            {VIEWS.map((v) => (
              <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>
            ))}
          </div>
        </div>
        {(view === "quarterly" || view === "yearly") && (
          <p className="muted small" style={{ marginTop: 0 }}>Added up from monthly entries. Ratios use the sums, and cash and CCC are the period’s latest month.</p>
        )}
        {missing && <p className="banner">{view === "weekly" ? `Week of ${missing.label}` : missing.label} has not been submitted yet.</p>}
        {!latest && <p className="empty">No {view === "weekly" ? "weekly" : "monthly"} entries yet.{canEdit && <> <Link href="/update">Add the first one</Link></>}</p>}

        {latest && (
          <>
            <p className="muted small">Showing {latest.label}{partial(latest) ? ` (${latest.monthsIn} of ${latest.monthsExpected} months entered)` : ""}, against {previous ? previous.label : "no earlier period"}.</p>
            <div className="tiles">
              {TILES.map((t) => {
                const cur = t.get(latest, fee);
                const prev = previous ? t.get(previous, fee) : null;
                const blocked = t.monthlyOnly && view === "weekly";
                let delta = "";
                let cls = "";
                if (!blocked && cur !== null && prev !== null) {
                  const d = t.delta === "abs" ? cur - prev : prev !== 0 ? (cur - prev) / Math.abs(prev) : NaN;
                  if (Number.isFinite(d)) {
                    delta = t.delta === "abs" ? `${d >= 0 ? "+" : "−"}${Math.abs(d)} days` : pct(d);
                    cls = (t.lowerIsBetter ? d <= 0 : d >= 0) ? "up" : "down";
                  }
                }
                return (
                  <div className="tile" key={t.id}>
                    <h3>{t.title}</h3>
                    {t.monthlyOnly && <span className="tag">Monthly only</span>}
                    <div className="v">{blocked ? "—" : t.fmt(cur)}</div>
                    <div className={`d ${cls}`}>{blocked ? "Switch to Monthly" : delta ? `${delta} vs ${previous?.label}` : ""}</div>
                    <div className="muted small">{t.id === "cm" && view === "weekly" ? "Shopify + Shopee only" : t.note}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h3 className="chart-title">Total revenue by {unit}</h3>
        <BarChart
          title={`Total revenue by ${unit}`}
          bars={periods.map((p) => ({
            label: p.label,
            value: p.flows ? derive(p.flows, fee).revenue : null,
            note: partial(p) ? `${p.monthsIn} of ${p.monthsExpected} months` : undefined,
          }))}
        />

        <details>
          <summary>Show the numbers</summary>
          <div className="scroll" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr><th>Period</th><th>Revenue</th>{TILES.map((t) => <th key={t.id}>{t.short}</th>)}</tr>
              </thead>
              <tbody>
                {[...periods].reverse().map((p) => (
                  <tr key={p.key}>
                    <td>{p.label}{partial(p) ? "*" : ""}</td>
                    <td>{p.flows ? rm(derive(p.flows, fee).revenue) : "not submitted"}</td>
                    {TILES.map((t) => (
                      <td key={t.id}>{p.entered && !(t.monthlyOnly && view === "weekly") ? t.fmt(t.get(p, fee)) : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(view === "quarterly" || view === "yearly") && <p className="muted small">* Not every month in this period has been entered.</p>}
        </details>
      </section>

      <Footer values={settings.core_values} editHref={canEdit ? "/update" : undefined} />
    </div>
  );
}
