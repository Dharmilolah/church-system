import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Users, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
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

  // Fetch stats in parallel
  const [membersRes, tithesRes, transactionsRes] = await Promise.all([
    supabase.from("members").select("id", { count: "exact" }).eq("church_id", churchId),
    supabase.from("tithe_records").select("amount").eq("church_id", churchId),
    supabase.from("transactions").select("amount, type").eq("church_id", churchId),
  ]);

  const totalMembers = membersRes.count || 0;
  const totalTithes = (tithesRes.data || []).reduce((sum, r) => sum + Number(r.amount), 0);
  const totalIncome = (transactionsRes.data || [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = (transactionsRes.data || [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Recent tithes
  const { data: recentTithes } = await supabase
    .from("tithe_records")
    .select("*, members(name)")
    .eq("church_id", churchId)
    .order("recorded_at", { ascending: false })
    .limit(5);

  // Recent transactions
  const { data: recentTransactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("church_id", churchId)
    .order("added_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your church finances</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Members"
          value={totalMembers.toString()}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Total Tithes"
          value={formatCurrency(totalTithes)}
          icon={<Wallet className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Total Income"
          value={formatCurrency(totalIncome)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses)}
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Net Balance */}
      <div className="card p-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <p className="text-primary-100 text-sm font-medium">Net Balance (Income + Tithes − Expenses)</p>
        <p className="text-4xl font-bold mt-2">{formatCurrency(totalTithes + totalIncome - totalExpenses)}</p>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tithes */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Tithes & Offerings</h3>
          {recentTithes && recentTithes.length > 0 ? (
            <div className="space-y-3">
              {recentTithes.map((tithe) => (
                <div key={tithe.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {tithe.is_anonymous ? "Anonymous" : (tithe.members as { name: string } | null)?.name || tithe.member_name || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(tithe.date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(tithe.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No tithes recorded yet</p>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          {recentTransactions && recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.category}</p>
                    <p className="text-xs text-gray-400">{tx.description || formatDate(tx.date)}</p>
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No transactions recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
