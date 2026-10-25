const n0 = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export const rm = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${v < 0 ? "−" : ""}RM ${n0.format(Math.abs(v))}`;
export const rmCompact = (v: number) => compact.format(v);
export const times = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${v.toFixed(2)}x`;
export const days = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${n0.format(v)} days`;
export const pct = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v >= 0 ? "+" : "−"}${(Math.abs(v) * 100).toFixed(1)}%`;
export const share = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`;
