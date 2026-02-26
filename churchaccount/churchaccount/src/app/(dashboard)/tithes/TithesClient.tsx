"use client";

import { useState } from "react";
import { Plus, Search, Trash2, HandCoins } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TitheRecord, Member, Branch } from "@/types";

interface Props {
  initialTithes: TitheRecord[];
  members: Pick<Member, "id" | "name">[];
  branches: Branch[];
  churchId: string;
  userId: string;
}

export default function TithesClient({ initialTithes, members, branches, churchId, userId }: Props) {
  const [tithes, setTithes] = useState(initialTithes);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    member_id: "",
    member_name: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    branch_id: "",
    is_anonymous: false,
  });
  const supabase = createClient();

  const totalTithes = tithes.reduce((sum, t) => sum + Number(t.amount), 0);

  const filtered = tithes.filter((t) => {
    const name = t.is_anonymous ? "anonymous" : (t.members as { name: string } | null)?.name || t.member_name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const member = members.find((m) => m.id === form.member_id);
    const { data, error } = await supabase
      .from("tithe_records")
      .insert({
        church_id: churchId,
        branch_id: form.branch_id || null,
        member_id: form.is_anonymous ? null : (form.member_id || null),
        member_name: form.is_anonymous ? null : (member?.name || form.member_name || null),
        amount: Number(form.amount),
        date: form.date,
        is_anonymous: form.is_anonymous,
        recorded_by: userId,
      })
      .select("*, members(name), branches(name)")
      .single();

    if (!error && data) {
      setTithes([data, ...tithes]);
      setForm({ member_id: "", member_name: "", amount: "", date: new Date().toISOString().slice(0, 10), branch_id: "", is_anonymous: false });
      setShowModal(false);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tithe record?")) return;
    const { error } = await supabase.from("tithe_records").delete().eq("id", id);
    if (!error) setTithes(tithes.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tithes & Offerings</h1>
          <p className="text-gray-500 text-sm mt-1">Total: {formatCurrency(totalTithes)}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Record Tithe
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by member name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Branch</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length > 0 ? filtered.map((tithe) => (
              <tr key={tithe.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">
                  {tithe.is_anonymous ? (
                    <span className="text-gray-400 italic">Anonymous</span>
                  ) : (
                    (tithe.members as { name: string } | null)?.name || tithe.member_name || "—"
                  )}
                </td>
                <td className="px-6 py-4 text-gray-500">{(tithe.branches as { name: string } | null)?.name || "—"}</td>
                <td className="px-6 py-4 text-gray-500">{formatDate(tithe.date)}</td>
                <td className="px-6 py-4 text-right font-semibold text-green-600">{formatCurrency(tithe.amount)}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(tithe.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">No tithe records found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-primary-600" />
              Record Tithe / Offering
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={form.is_anonymous}
                  onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="anonymous" className="text-sm text-gray-700">Anonymous offering</label>
              </div>
              {!form.is_anonymous && (
                <div>
                  <label className="label">Member</label>
                  <select
                    value={form.member_id}
                    onChange={(e) => setForm({ ...form, member_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Select member or type name</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  {!form.member_id && (
                    <input
                      type="text"
                      placeholder="Or enter name manually"
                      value={form.member_name}
                      onChange={(e) => setForm({ ...form, member_name: e.target.value })}
                      className="input mt-2"
                    />
                  )}
                </div>
              )}
              <div>
                <label className="label">Amount (₦) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="input"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="label">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="input"
                  required
                />
              </div>
              {branches.length > 0 && (
                <div>
                  <label className="label">Branch</label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                    className="input"
                  >
                    <option value="">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? "Recording..." : "Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
