'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://isvqwielxbbmplwpzaob.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdnF3aWVseGJibXBsd3B6YW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNDkyNzIsImV4cCI6MjA4MzYyNTI3Mn0.G3M9RZTfxyguC9-bt-HIVfCAgQR3c0epqfm4w_ureq4'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

type Tab = 'dashboard' | 'transactions' | 'tithe' | 'reports'
interface AppUser { id: string; email: string; role: string; name: string }
interface Church { id: string; name: string; code: string }
interface Branch { id: string; name: string; code: string; church_id: string }
interface Transaction { id: string; type: string; category: string; amount: number; date: string; description: string }
interface Tithe { id: string; member_name: string; amount: number; date: string }
interface Member { id: string; name: string }
interface Category { id: string; name: string; type: string }

export default function Home() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [church, setChurch] = useState<Church | null>(null)
  const [branch, setBranch] = useState<Branch | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tithes, setTithes] = useState<Tithe[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currentTab, setCurrentTab] = useState<Tab>('dashboard')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [email, setEmail] = useState('dadenike51@gmail.com')
  const [password, setPassword] = useState('')

  // Transaction form
  const [txnType, setTxnType] = useState('income')
  const [txnCategory, setTxnCategory] = useState('')
  const [txnAmount, setTxnAmount] = useState('')
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0])
  const [txnDesc, setTxnDesc] = useState('')

  // Tithe form
  const [titheMember, setTitheMember] = useState('')
  const [titheAmount, setTitheAmount] = useState('')
  const [titheDate, setTitheDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setEmail(session.user.email ?? '')
    })
  }, [])

  const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(n)
  const toNum = (v: unknown) => parseFloat(String(v)) || 0

  async function createDefaultCategories(churchId: string) {
    const defaults = [
      { name: 'Tithe', type: 'income', church_id: churchId },
      { name: 'Offering', type: 'income', church_id: churchId },
      { name: 'Donation', type: 'income', church_id: churchId },
      { name: 'Rent', type: 'expense', church_id: churchId },
      { name: 'Utilities', type: 'expense', church_id: churchId },
      { name: 'Salaries', type: 'expense', church_id: churchId },
      { name: 'Maintenance', type: 'expense', church_id: churchId },
    ]
    const { data } = await supabase.from('categories').insert(defaults).select()
    if (data) setCategories(data)
  }

  async function loadData(churchId: string, branchId: string) {
    const [catsRes, txnsRes, tithesRes, membersRes] = await Promise.all([
      supabase.from('categories').select('*').eq('church_id', churchId).order('name'),
      supabase.from('transactions').select('*').eq('branch_id', branchId).order('date', { ascending: false }),
      supabase.from('tithe_records').select('*').eq('branch_id', branchId).order('date', { ascending: false }),
      supabase.from('members').select('*').eq('church_id', churchId).order('name'),
    ])
    const cats = catsRes.data || []
    if (cats.length === 0) await createDefaultCategories(churchId)
    else setCategories(cats)
    setTransactions(txnsRes.data || [])
    setTithes(tithesRes.data || [])
    setMembers(membersRes.data || [])
  }

  async function login() {
    if (!email || !password) { setLoginError('Please enter email and password'); return }
    setLoading(true)
    setLoginError('')
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError

      const { data: userData, error: userError } = await supabase
        .from('profiles').select('id, role, church_id, churches(id, name, code)')
        .eq('id', authData.user.id).single()
      if (userError) throw new Error(`Profile error: ${userError.message}`)
      if (!userData?.churches) throw new Error('User not linked to a church.')

      const churchData = userData.churches as unknown as Church
      setUser({ id: userData.id, email: authData.user.email!, role: userData.role, name: authData.user.email!.split('@')[0] })
      setChurch(churchData)

      const { data: branches } = await supabase.from('branches').select('*').eq('church_id', churchData.id).limit(1)
      let branchData: Branch
      if (branches && branches.length > 0) {
        branchData = branches[0]
      } else {
        const { data: nb } = await supabase.from('branches').insert({ church_id: churchData.id, name: 'Main Branch', code: 'MAIN' }).select().single()
        branchData = nb!
      }
      setBranch(branchData)
      await loadData(churchData.id, branchData.id)
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  async function addTransaction() {
    if (!txnCategory || !txnAmount || !txnDate) { alert('Please fill all required fields'); return }
    const { data, error } = await supabase.from('transactions').insert({
      church_id: church!.id, branch_id: branch!.id, type: txnType,
      category: txnCategory, amount: parseFloat(txnAmount), date: txnDate,
      description: txnDesc, added_by: user!.id
    }).select().single()
    if (error) { alert('Error: ' + error.message); return }
    setTransactions(p => [data, ...p])
    setTxnCategory(''); setTxnAmount(''); setTxnDesc('')
    alert('✅ Transaction added!')
  }

  async function deleteTransaction(id: string) {
    if (!confirm('Delete this transaction?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setTransactions(p => p.filter(t => t.id !== id))
  }

  async function addTithe() {
    if (!titheMember || !titheAmount || !titheDate) { alert('Please fill all fields'); return }
    const { data, error } = await supabase.from('tithe_records').insert({
      church_id: church!.id, branch_id: branch!.id,
      member_name: titheMember, amount: parseFloat(titheAmount),
      date: titheDate, recorded_by: user!.id
    }).select().single()
    if (error) { alert('Error: ' + error.message); return }
    setTithes(p => [data, ...p])
    setTitheAmount(''); setTitheMember('')
    alert('✅ Tithe recorded!')
  }

  async function deleteTithe(id: string) {
    if (!confirm('Delete this tithe record?')) return
    const { error } = await supabase.from('tithe_records').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setTithes(p => p.filter(t => t.id !== id))
  }

  async function addMember() {
    const name = prompt('Enter member name:')
    if (!name?.trim()) return
    const { data, error } = await supabase.from('members').insert({ church_id: church!.id, name: name.trim() }).select().single()
    if (error) { alert('Error: ' + error.message); return }
    setMembers(p => [...p, data])
    alert('✅ Member added!')
  }

  async function logout() {
    if (!confirm('Are you sure you want to logout?')) return
    await supabase.auth.signOut()
    setUser(null); setChurch(null); setBranch(null)
    setTransactions([]); setTithes([]); setMembers([]); setCategories([])
  }

  function allStats() {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + toNum(t.amount), 0)
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + toNum(t.amount), 0)
    const totalTithes = tithes.reduce((s, t) => s + toNum(t.amount), 0)
    return { income, expenses, balance: income - expenses, totalTithes }
  }

  function monthStats() {
    const now = new Date()
    const month = selectedMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const filtered = transactions.filter(t => t.date.startsWith(month))
    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + toNum(t.amount), 0)
    const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + toNum(t.amount), 0)
    return { income, expenses, balance: income - expenses, count: filtered.length }
  }

  const monthOptions = Array.from(new Set(transactions.map(t => t.date.substring(0, 7)))).sort().reverse()
  const filteredCats = categories.filter(c => c.type === txnType)
  const stats = allStats()
  const mStats = monthStats()

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        {loading && (
          <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-700 font-medium">Loading...</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-indigo-900 mb-1">🏛️ Canaan Baptist Church</h1>
            <p className="text-gray-500">Accounting System</p>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-5">🔐 Login</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none"
                placeholder="Enter password" />
            </div>
            <button onClick={login} className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition font-semibold text-lg">
              Login
            </button>
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-5 mb-5 flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-indigo-900">🏛️ {church?.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Branch: {branch?.name} · {user.name} ({user.role})</p>
        </div>
        <button onClick={logout} className="px-5 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition font-medium text-sm">
          Logout
        </button>
      </div>

      {/* Nav */}
      <div className="bg-white rounded-2xl shadow-lg p-3 mb-5 flex gap-2 flex-wrap">
        {(['dashboard','transactions','tithe','reports'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setCurrentTab(tab)}
            className={`px-5 py-2.5 rounded-xl font-medium transition text-sm ${currentTab === tab ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {tab === 'dashboard' ? '📊 Dashboard' : tab === 'transactions' ? '💰 Transactions' : tab === 'tithe' ? '📖 Tithes' : '📈 Reports'}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {currentTab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Total Income', val: stats.income, from: 'from-green-400', to: 'to-green-600' },
              { label: 'Total Expenses', val: stats.expenses, from: 'from-red-400', to: 'to-red-600' },
              { label: 'Balance', val: stats.balance, from: 'from-blue-400', to: 'to-blue-600' },
              { label: 'Total Tithes', val: stats.totalTithes, from: 'from-purple-400', to: 'to-purple-600' },
            ].map(card => (
              <div key={card.label} className={`bg-gradient-to-br ${card.from} ${card.to} rounded-2xl p-5 text-white shadow-lg`}>
                <p className="text-sm opacity-80 mb-1">{card.label}</p>
                <p className="text-xl md:text-2xl font-bold">{fmt(card.val)}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Quick Stats</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl text-center">
                <p className="text-gray-500 text-sm">Transactions</p>
                <p className="text-2xl font-bold text-blue-600">{transactions.length}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl text-center">
                <p className="text-gray-500 text-sm">Tithe Records</p>
                <p className="text-2xl font-bold text-green-600">{tithes.length}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl text-center">
                <p className="text-gray-500 text-sm">Members</p>
                <p className="text-2xl font-bold text-purple-600">{members.length}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transactions */}
      {currentTab === 'transactions' && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-5">➕ Add Transaction</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
                <select value={txnType} onChange={e => { setTxnType(e.target.value); setTxnCategory('') }}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
                <select value={txnCategory} onChange={e => setTxnCategory(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none">
                  <option value="">Select category...</option>
                  {filteredCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (₦)</label>
                <input type="number" value={txnAmount} onChange={e => setTxnAmount(e.target.value)} step="0.01" placeholder="0.00"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Description (Optional)</label>
                <input type="text" value={txnDesc} onChange={e => setTxnDesc(e.target.value)} placeholder="Optional notes..."
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <button onClick={addTransaction} className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition font-semibold">
                Add Transaction
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-5">📋 All Transactions ({transactions.length})</h2>
            {transactions.length === 0
              ? <p className="text-center text-gray-400 py-10">No transactions yet</p>
              : <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {transactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{t.category}</p>
                        <p className="text-xs text-gray-400">{t.date}</p>
                      </div>
                      <p className={`font-bold mx-3 ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                        {fmt(toNum(t.amount))}
                      </p>
                      <button onClick={() => deleteTransaction(t.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 text-sm">🗑️</button>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* Tithes */}
      {currentTab === 'tithe' && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-5">➕ Record Tithe</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Member</label>
                <select value={titheMember} onChange={e => setTitheMember(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none">
                  <option value="">Select member...</option>
                  <option value="Anonymous">Anonymous</option>
                  {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <button onClick={addMember} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add New Member</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (₦)</label>
                <input type="number" value={titheAmount} onChange={e => setTitheAmount(e.target.value)} step="0.01" placeholder="0.00"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={titheDate} onChange={e => setTitheDate(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <button onClick={addTithe} className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition font-semibold">
                Record Tithe
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-5">📖 Tithe Records ({tithes.length})</h2>
            {tithes.length === 0
              ? <p className="text-center text-gray-400 py-10">No tithe records yet</p>
              : <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {tithes.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                      <div>
                        <p className="font-medium text-gray-800">{t.member_name}</p>
                        <p className="text-xs text-gray-400">{t.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{fmt(toNum(t.amount))}</p>
                        <button onClick={() => deleteTithe(t.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* Reports */}
      {currentTab === 'reports' && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-5">📈 Monthly Reports</h2>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-600 mb-1">Select Month</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:outline-none">
              <option value="">Current Month</option>
              {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-5 bg-green-50 rounded-xl">
              <p className="text-gray-500 text-sm mb-1">Income</p>
              <p className="text-xl font-bold text-green-600">{fmt(mStats.income)}</p>
            </div>
            <div className="p-5 bg-red-50 rounded-xl">
              <p className="text-gray-500 text-sm mb-1">Expenses</p>
              <p className="text-xl font-bold text-red-500">{fmt(mStats.expenses)}</p>
            </div>
            <div className="p-5 bg-blue-50 rounded-xl">
              <p className="text-gray-500 text-sm mb-1">Balance</p>
              <p className="text-xl font-bold text-blue-600">{fmt(mStats.balance)}</p>
            </div>
          </div>
          <p className="text-center text-gray-400 text-sm">{mStats.count} transactions this period</p>
        </div>
      )}
    </div>
  )
}
