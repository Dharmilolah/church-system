import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userProfile } = await supabase
    .from("users")
    .select("church_id, role")
    .eq("id", user.id)
    .single();

  if (!userProfile?.church_id) redirect("/login");
  const churchId = userProfile.church_id;

  const [transactionsRes, categoriesRes, branchesRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, branches(name)")
      .eq("church_id", churchId)
      .order("date", { ascending: false }),
    supabase.from("categories").select("id, name, type").eq("church_id", churchId),
    supabase.from("branches").select("id, name").eq("church_id", churchId),
  ]);

  return (
    <ExpensesClient
      initialTransactions={transactionsRes.data || []}
      categories={categoriesRes.data || []}
      branches={branchesRes.data || []}
      churchId={churchId}
      userId={user.id}
    />
  );
}
