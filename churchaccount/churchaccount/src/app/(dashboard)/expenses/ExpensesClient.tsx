"use client";

import { useState } from "react";
import { Plus, Search, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Transaction, Category, Branch } from "@/types";

interface Props {
  initialTransactions: Transaction[];
  categories: Category[];
  branches: Branch[];
  churchId: string;
  userId: string;
}

export default function ExpensesClient({ initialTransactions, categories, branches, churchId, userId }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    branch_id: "",
  });
  const supabase = createClient();

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const filtered = transactions.filter((t) => {
    const matchesTab = activeTab === "all" || t.type === activeTab;
    const matchesSearch = t.category.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        church_id: churchId,
        branch_id: form.branch_id || null,
        type: form.type,
        category: form.category,
        amount: Number(form.amount),
        date: form.date,
        description: form.description || null,
        added_by: userId,
      })
      .select("*, branches(name)")
      .single();

    if (!error && data) {
      setTransactions([data, ...transactions]);
      setForm({ type: "expense", category: "", amount: "", date: new Date().toISOString().slice(0, 10), description: "", branch_id: "" });
      setShowModal(false);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (!error) setTransactions(transactions.filter((t) => t.id !== id));
  };

  const filteredCategories = categories.filter((c) => c.type === form.type);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income & Expenses</h1>
          <p className="text-gray-500 text-sm mt-1">Track all financial transactions</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Total Income</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Total Expenses</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Net Balance</p>
          <p className={cn("text-xl font-bold mt-1", totalIncome - totalExpenses >= 0 ? "text-green-600" : "text-red-600")}>
            {formatCurrency(totalIncome - totalExpenses)}
          </p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["all", "income", "expense"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
                activeTab === tab ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by category or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length > 0 ? filtered.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                    tx.type === "income" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  )}>
                    {tx.type === "income" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {tx.type}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">{tx.category}</td>
                <td className="px-6 py-4 text-gray-500">{tx.description || "—"}</td>
                <td className="px-6 py-4 text-gray-500">{formatDate(tx.date)}</td>
                <td className={cn("px-6 py-4 text-right font-semibold", tx.type === "income" ? "text-green-600" : "text-red-600")}>
                  {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(tx.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No transactions found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Transaction</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="label">Type *</label>
                <div className="flex gap-2">
                  {(["income", "expense"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, type: t, category: "" })}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium border transition-all capitalize",
                        form.type === t
                          ? t === "income" ? "bg-green-50 border-green-300 text-green-700" : "bg-red-50 border-red-300 text-red-700"
                          : "bg-white border-gray-300 text-gray-600"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Category *</label>
                {filteredCategories.length > 0 ? (
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">Select category</option>
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input"
                    placeholder="e.g. Utilities, Building Fund"
                    required
                  />
                )}
              </div>
              <div>
                <label className="label">Amount (₦) *</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" min="0" step="0.01" required />
              </div>
              <div>
                <label className="label">Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="Optional note" />
              </div>
              {branches.length > 0 && (
                <div>
                  <label className="label">Branch</label>
                  <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className="input">
                    <option value="">All branches</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
