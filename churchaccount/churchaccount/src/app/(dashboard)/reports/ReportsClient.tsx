"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO, startOfMonth } from "date-fns";

interface Props {
  tithes: { amount: number; date: string }[];
  transactions: { amount: number; type: string; date: string; category: string }[];
  members: { id: string; added_at: string }[];
}

const COLORS = ["#4a6cf3", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function groupByMonth(items: { amount?: number; date?: string; added_at?: string }[], valueKey: "amount" | "count" = "amount") {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    const dateStr = (item as { date?: string; added_at?: string }).date || (item as { added_at?: string }).added_at;
    if (!dateStr) return;
    const month = format(startOfMonth(parseISO(dateStr)), "MMM yyyy");
    if (valueKey === "amount") {
      map[month] = (map[month] || 0) + Number((item as { amount: number }).amount);
    } else {
      map[month] = (map[month] || 0) + 1;
    }
  });
  return Object.entries(map)
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
    .slice(-6);
}

export default function ReportsClient({ tithes, transactions, members }: Props) {
  const tithesByMonth = groupByMonth(tithes);
  const incomeByMonth = groupByMonth(transactions.filter((t) => t.type === "income"));
  const expensesByMonth = groupByMonth(transactions.filter((t) => t.type === "expense"));
  const membersByMonth = groupByMonth(members.map((m) => ({ added_at: m.added_at })), "count");

  // Merge income/expense by month
  const allMonths = Array.from(new Set([...incomeByMonth.map((d) => d.month), ...expensesByMonth.map((d) => d.month)])).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const incomeExpenseData = allMonths.map((month) => ({
    month,
    income: incomeByMonth.find((d) => d.month === month)?.value || 0,
    expenses: expensesByMonth.find((d) => d.month === month)?.value || 0,
  }));

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  transactions.forEach((t) => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + Number(t.amount);
  });
  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const totalTithes = tithes.reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Financial overview and analytics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-500">All-time Tithes</p>
          <p className="text-xl font-bold text-purple-600 mt-1">{formatCurrency(totalTithes)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-500">All-time Income</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-500">All-time Expenses</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tithes by Month */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tithes by Month</h3>
          {tithesByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tithesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Tithes" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Income vs Expenses */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Income vs Expenses</h3>
          {incomeExpenseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={incomeExpenseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Spending by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Member Growth */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Member Growth</h3>
          {membersByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={membersByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#4a6cf3" strokeWidth={2} dot={{ fill: "#4a6cf3" }} name="New Members" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
