import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/Dashboard";
import type { Settings } from "@/components/SettingsPanel";
import type { MonthlyRow, WeeklyRow } from "@/lib/calc";

export const dynamic = "force-dynamic";

export default async function Page() {
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
  if (failed) {
    return (
      <main className="wrap">
        <div className="card">
          <h1>Setup needed</h1>
          <p className="err">{failed.message}</p>
          <p className="muted">Run supabase/schema.sql in the Supabase SQL editor, then reload.</p>
        </div>
      </main>
    );
  }

  const s = settings.data;
  const cfg: Settings = {
    vision: s?.vision ?? "",
    core_values: (s?.core_values as Settings["core_values"]) ?? [],
    target_2027: s?.target_2027 === null || s?.target_2027 === undefined ? null : Number(s.target_2027),
    fee_rate: s?.fee_rate === undefined ? 0.1 : Number(s.fee_rate),
  };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

  return (
    <Dashboard
      role={profile.data?.role === "editor" ? "editor" : "viewer"}
      email={auth.user.email ?? ""}
      settings={cfg}
      weekly={(weekly.data ?? []) as WeeklyRow[]}
      monthly={(monthly.data ?? []) as MonthlyRow[]}
      today={today}
    />
  );
}
