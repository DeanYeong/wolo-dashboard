import { redirect } from "next/navigation";
import UpdateTabs from "@/components/UpdateTabs";
import { loadAll, SetupNeeded } from "@/lib/load";

export const dynamic = "force-dynamic";

// Only editors can enter or change numbers. View-only logins are sent back to the dashboard.
export default async function UpdatePage() {
  const d = await loadAll();
  if ("error" in d) return <SetupNeeded message={d.error} />;
  if (d.role !== "editor") redirect("/");
  return <UpdateTabs settings={d.settings} weekly={d.weekly} monthly={d.monthly} today={d.today} email={d.email} />;
}
