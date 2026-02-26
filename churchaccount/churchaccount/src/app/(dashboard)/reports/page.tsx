import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userProfile } = await supabase
    .from("users")
    .select("church_id")
    .eq("id", user.id)
    .single();

  if (!userProfile?.church_id) redirect("/login");
  const churchId = userProfile.church_id;

  const [tithesRes, transactionsRes, membersRes] = await Promise.all([
    supabase.from("tithe_records").select("amount, date").eq("church_id", churchId),
    supabase.from("transactions").select("amount, type, date, category").eq("church_id", churchId),
    supabase.from("members").select("id, added_at").eq("church_id", churchId),
  ]);

  return (
    <ReportsClient
      tithes={tithesRes.data || []}
      transactions={transactionsRes.data || []}
      members={membersRes.data || []}
    />
  );
}
