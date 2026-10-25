import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Settings } from "@/components/SettingsForm";
import type { MonthlyRow, WeeklyRow } from "@/lib/calc";

export type Loaded =
  | { error: string }
  | { role: "editor" | "viewer"; email: string; settings: Settings; weekly: WeeklyRow[]; monthly: MonthlyRow[]; today: string };

// Shared by the dashboard and the Update page: who is signed in, and all stored data.
export async function loadAll(): Promise<Loaded> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [profile, settings, weekly, monthly] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
    supabase.from("settings").select("vision, core_values, target_2027, fee_rate").eq("id", 1).maybeSingle(),
    supabase.from("weekly_entries").select("*").order("week_start"),
    supabase.from("monthly_entries").select("*").order("month_start"),
  ]);
  const failed = [settings.error, weekly.error, monthly.error].find(Boolean);
  if (failed) return { error: failed.message };

  const s = settings.data;
  return {
    role: profile.data?.role === "editor" ? "editor" : "viewer",
    email: auth.user.email ?? "",
    settings: {
      vision: s?.vision ?? "",
      core_values: (s?.core_values as Settings["core_values"]) ?? [],
      target_2027: s?.target_2027 === null || s?.target_2027 === undefined ? null : Number(s.target_2027),
      fee_rate: s?.fee_rate === undefined ? 0.1 : Number(s.fee_rate),
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
