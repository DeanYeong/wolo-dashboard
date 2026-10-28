import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Settings, ValueItem } from "@/components/SettingsForm";
import type { MonthlyRow, WeeklyRow } from "@/lib/calc";

export type Loaded =
  | { error: string }
  | { role: "editor" | "viewer"; email: string; settings: Settings; weekly: WeeklyRow[]; monthly: MonthlyRow[]; today: string };

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

// Shared by the dashboard and the Update page: who is signed in, and all stored data.
export async function loadAll(): Promise<Loaded> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const getSettings = async () => {
    const full = await supabase.from("settings").select("vision, core_values, target_2027, target_year, fee_rate").eq("id", 1).maybeSingle();
    if (!full.error) return full;
    // A database set up before target_year existed: keep everything else working.
    return supabase.from("settings").select("vision, core_values, target_2027, fee_rate").eq("id", 1).maybeSingle();
  };

  const [profile, settings, weekly, monthly] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
    getSettings(),
    supabase.from("weekly_entries").select("*").order("week_start"),
    supabase.from("monthly_entries").select("*").order("month_start"),
  ]);
  const failed = [settings.error, weekly.error, monthly.error].find(Boolean);
  if (failed) return { error: failed.message };

  const s = (settings.data ?? {}) as Record<string, unknown>;
  return {
    role: profile.data?.role === "editor" ? "editor" : "viewer",
    email: auth.user.email ?? "",
    settings: {
      vision: typeof s.vision === "string" ? s.vision : "",
      core_values: Array.isArray(s.core_values) ? (s.core_values as ValueItem[]) : [],
      target_2027: num(s.target_2027),
      target_year: num(s.target_year),
      fee_rate: num(s.fee_rate) ?? 0.1,
    },
    weekly: (weekly.data ?? []) as WeeklyRow[],
    monthly: (monthly.data ?? []) as MonthlyRow[],
    today: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }),
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
