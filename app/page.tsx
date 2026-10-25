import Dashboard from "@/components/Dashboard";
import { loadAll, SetupNeeded } from "@/lib/load";

export const dynamic = "force-dynamic";

export default async function Page() {
  const d = await loadAll();
  if ("error" in d) return <SetupNeeded message={d.error} />;
  return <Dashboard {...d} />;
}
