import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TithesClient from "./TithesClient";

export default async function TithesPage() {
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

  const [tithesRes, membersRes, branchesRes] = await Promise.all([
    supabase
      .from("tithe_records")
      .select("*, members(name), branches(name)")
      .eq("church_id", churchId)
      .order("date", { ascending: false }),
    supabase.from("members").select("id, name").eq("church_id", churchId).order("name"),
    supabase.from("branches").select("id, name").eq("church_id", churchId),
  ]);

  return (
    <TithesClient
      initialTithes={tithesRes.data || []}
      members={membersRes.data || []}
      branches={branchesRes.data || []}
      churchId={churchId}
      userId={user.id}
    />
  );
}
