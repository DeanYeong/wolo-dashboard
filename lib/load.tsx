import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Settings, ValueItem } from "@/components/SettingsForm";
import type { MonthlyRow, Target, WeeklyRow } from "@/lib/calc";

export type Loaded =
  | { error: string }
  | {
      role: "editor" | "viewer";
      email: string;
      settings: Settings;
      targets: Target[];
      targetsReady: boolean; // false until the annual_targets table exists in the database
      weekly: WeeklyRow[];
      monthly: MonthlyRow[];
      today: string;
    };

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

// Shared by the dashboard and the Update page: who is signed in, and all stored data.
export async function loadAll(): Promise<Loaded> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [profile, settings, weekly, monthly, tgt] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
    supabase.from("settings").select("vision, core_values, fee_rate").eq("id", 1).maybeSingle(),
    supabase.from("weekly_entries").select("*").order("week_start"),
    supabase.from("monthly_entries").select("*").order("month_start"),
    supabase.from("annual_targets").select("year, amount").order("year"),
  ]);
  const failed = [settings.error, weekly.error, monthly.error].find(Boolean);
  if (failed) return { error: failed.message };

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

  let targets: Target[] = [];
  const targetsReady = !tgt.error;
  if (!tgt.error) {
    targets = (tgt.data ?? []).map((r) => ({ year: Number(r.year), amount: Number(r.amount) })).filter((t) => t.amount > 0);
  } else {
    // Database not updated yet: keep showing the single target stored in the older settings columns.
    let legacy = await supabase.from("settings").select("target_2027, target_year").eq("id", 1).maybeSingle();
    if (legacy.error) legacy = await supabase.from("settings").select("target_2027").eq("id", 1).maybeSingle();
    const row = (legacy.data ?? {}) as Record<string, unknown>;
    const amount = num(row.target_2027);
    if (amount && amount > 0) targets = [{ year: num(row.target_year) ?? Number(today.slice(0, 4)), amount }];
  }

  const s = (settings.data ?? {}) as Record<string, unknown>;
  return {
    role: profile.data?.role === "editor" ? "editor" : "viewer",
    email: auth.user.email ?? "",
    settings: {
      vision: typeof s.vision === "string" ? s.vision : "",
      core_values: Array.isArray(s.core_values) ? (s.core_values as ValueItem[]) : [],
      fee_rate: num(s.fee_rate) ?? 0.1,
    },
    targets,
    targetsReady,
    weekly: (weekly.data ?? []) as WeeklyRow[],
    monthly: (monthly.data ?? []) as MonthlyRow[],
    today,
  };
}

export function SetupNeeded({ message }: { message: string }) {
  return (
    <main className="wrap">
      <div className="card">
        <h1>Setup needed</h1>
        <p className="err">{message}</p>
        <p className="muted">Run supabase/schema.sql in the Supabase SQL editor, then reload.</p>
      </div>
    </main>
  );
}
