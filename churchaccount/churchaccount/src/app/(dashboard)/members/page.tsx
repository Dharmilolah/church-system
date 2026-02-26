import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MembersClient from "./MembersClient";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userProfile } = await supabase
    .from("users")
    .select("church_id, role")
    .eq("id", user.id)
    .single();

  if (!userProfile?.church_id) redirect("/login");

  const { data: members } = await supabase
    .from("members")
    .select("*, branches(name)")
    .eq("church_id", userProfile.church_id)
    .order("added_at", { ascending: false });

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("church_id", userProfile.church_id);

  return (
    <MembersClient
      initialMembers={members || []}
      branches={branches || []}
      churchId={userProfile.church_id}
      userId={user.id}
    />
  );
}
