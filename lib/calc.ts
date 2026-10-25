// All dashboard maths lives here so it can be tested without a browser or a database.
// Dates are ISO strings (YYYY-MM-DD). Weeks start on Monday. Quarters and years are sums of monthly entries.

export const FLOW_KEYS = [
  "shopify_revenue",
  "shopee_revenue",
  "other_revenue",
  "shopify_cogs",
  "shopee_cogs",
  "other_cogs",
  "meta_spend",
  "google_spend",
  "shopee_ads",
  "affiliate",
] as const;
export type FlowKey = (typeof FLOW_KEYS)[number];
export type Flows = Record<FlowKey, number>;

export type WeeklyRow = Partial<Flows> & { week_start: string };
export type MonthlyRow = Partial<Flows> & {
  month_start: string;
  ccc_days: number | null;
  cash_in_bank: number | null;
};

export type View = "weekly" | "monthly" | "quarterly" | "yearly";

export type Period = {
  key: string;
  label: string;
  entered: boolean;
  flows: Flows | null;
  cash: number | null;
  ccc: number | null;
  monthsIn: number; // quarterly/yearly: how many monthly entries went into it
  monthsExpected: number; // 3 for a quarter, 12 for a year, 1 otherwise
};

export const zeroFlows = (): Flows =>
  Object.fromEntries(FLOW_KEYS.map((k) => [k, 0])) as Flows;

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));

export const toFlows = (row: Partial<Flows>): Flows => {
  const f = zeroFlows();
  FLOW_KEYS.forEach((k) => (f[k] = num(row[k])));
  return f;
};

export const addFlows = (a: Flows, b: Flows): Flows => {
  const f = zeroFlows();
  FLOW_KEYS.forEach((k) => (f[k] = a[k] + b[k]));
  return f;
};

// ---------- dates ----------
const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};
export const mondayOf = (iso: string) => {
  const d = parse(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return fmt(d);
};
export const monthStartOf = (iso: string) => iso.slice(0, 7) + "-01";
export const addMonths = (iso: string, n: number) => {
  const d = parse(monthStartOf(iso));
  d.setUTCMonth(d.getUTCMonth() + n);
  return fmt(d);
};
export const quarterKey = (iso: string) => {
  const y = iso.slice(0, 4);
  const q = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
  return `${y}-Q${q}`;
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
export const weekLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const quarterLabel = (key: string) => `${key.slice(5)} ${key.slice(2, 4)}`;

// ---------- metrics ----------
export type Derived = {
  revenue: number;
  shopifyGpPerAd: number | null; // (Shopify revenue - Shopify COGS) / (Meta + Google + affiliate)
  shopeeGpPerAd: number | null; // (Shopee revenue - Shopee COGS) / Shopee ads
  contribution: number; // revenue*(1-fee) - COGS - Meta - Google - Shopee ads - affiliate
};

export function derive(f: Flows, feeRate: number): Derived {
  const revenue = f.shopify_revenue + f.shopee_revenue + f.other_revenue;
  const cogs = f.shopify_cogs + f.shopee_cogs + f.other_cogs;
  const shopifyAd = f.meta_spend + f.google_spend + f.affiliate;
  const ratio = (gp: number, ad: number) => (ad > 0 ? gp / ad : null);
  return {
    revenue,
    shopifyGpPerAd: ratio(f.shopify_revenue - f.shopify_cogs, shopifyAd),
    shopeeGpPerAd: ratio(f.shopee_revenue - f.shopee_cogs, f.shopee_ads),
    contribution:
      revenue * (1 - feeRate) - cogs - f.meta_spend - f.google_spend - f.shopee_ads - f.affiliate,
  };
}

// ---------- periods ----------
const COUNT: Record<View, number> = { weekly: 12, monthly: 12, quarterly: 8, yearly: 4 };

export function currentKey(view: View, today: string): string {
  if (view === "weekly") return mondayOf(today);
  if (view === "monthly") return monthStartOf(today);
  if (view === "quarterly") return quarterKey(today);
  return today.slice(0, 4);
}

export function buildPeriods(view: View, weekly: WeeklyRow[], monthly: MonthlyRow[], today: string): Period[] {
  const empty = (key: string, label: string, monthsExpected: number): Period => ({
    key, label, entered: false, flows: null, cash: null, ccc: null, monthsIn: 0, monthsExpected,
  });
  const n = COUNT[view];

  if (view === "weekly") {
    const byKey = new Map(weekly.map((r) => [r.week_start, r]));
    const end = mondayOf(today);
    return Array.from({ length: n }, (_, i) => {
      const key = addDays(end, -7 * (n - 1 - i));
      const r = byKey.get(key);
      const p = empty(key, weekLabel(key), 1);
      if (r) Object.assign(p, { entered: true, flows: toFlows(r), monthsIn: 1 });
      return p;
    });
  }

  if (view === "monthly") {
    const byKey = new Map(monthly.map((r) => [r.month_start, r]));
    const end = monthStartOf(today);
    return Array.from({ length: n }, (_, i) => {
      const key = addMonths(end, -(n - 1 - i));
      const r = byKey.get(key);
      const p = empty(key, monthLabel(key), 1);
      if (r) Object.assign(p, { entered: true, flows: toFlows(r), cash: r.cash_in_bank ?? null, ccc: r.ccc_days ?? null, monthsIn: 1 });
      return p;
    });
  }

  // quarterly and yearly: add up the monthly entries
  const keyOf = view === "quarterly" ? quarterKey : (iso: string) => iso.slice(0, 4);
  const expected = view === "quarterly" ? 3 : 12;
  const groups = new Map<string, MonthlyRow[]>();
  [...monthly].sort((a, b) => (a.month_start < b.month_start ? -1 : 1)).forEach((r) => {
    const k = keyOf(r.month_start);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  });
  const keys: string[] = [];
  if (view === "quarterly") {
    let m = addMonths(monthStartOf(today), -3 * (n - 1));
    for (let i = 0; i < n; i++, m = addMonths(m, 3)) keys.push(quarterKey(m));
  } else {
    const y = Number(today.slice(0, 4));
    for (let i = n - 1; i >= 0; i--) keys.push(String(y - i));
  }
  return keys.map((key) => {
    const rows = groups.get(key) ?? [];
    const label = view === "quarterly" ? quarterLabel(key) : key;
    const p = empty(key, label, expected);
    if (rows.length) {
      const last = rows[rows.length - 1];
      Object.assign(p, {
        entered: true,
        flows: rows.reduce((acc, r) => addFlows(acc, toFlows(r)), zeroFlows()),
        // balances are not added up: the period's cash and CCC are its latest month's
        cash: last.cash_in_bank ?? null,
        ccc: last.ccc_days ?? null,
        monthsIn: rows.length,
      });
    }
    return p;
  });
}

// The most recent finished week or month with no entry (weekly and monthly views only).
export function missingCompleted(view: View, periods: Period[], today: string): Period | null {
  if (view !== "weekly" && view !== "monthly") return null;
  const cur = currentKey(view, today);
  const done = periods.filter((p) => p.key < cur);
  const last = done[done.length - 1];
  return last && !last.entered ? last : null;
}

// ---------- 2027 target ----------
export function yearToDate(monthly: MonthlyRow[], year: number): number {
  return monthly
    .filter((r) => r.month_start.startsWith(String(year)))
    .reduce((t, r) => t + derive(toFlows(r), 0).revenue, 0);
}

export function paceShare(today: string, year: number): number | null {
  if (Number(today.slice(0, 4)) !== year) return null;
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const now = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  return (now - start) / (end - start);
}
