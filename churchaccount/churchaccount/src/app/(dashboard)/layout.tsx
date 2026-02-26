import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userProfile } = await supabase
    .from("users")
    .select("*, churches(name)")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar userRole={userProfile?.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          userEmail={user.email || ""}
          churchName={(userProfile?.churches as { name: string })?.name || "My Church"}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
