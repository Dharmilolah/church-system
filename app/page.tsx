'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://isvqwielxbbmplwpzaob.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdnF3aWVseGJibXBsd3B6YW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNDkyNzIsImV4cCI6MjA4MzYyNTI3Mn0.G3M9RZTfxyguC9-bt-HIVfCAgQR3c0epqfm4w_ureq4'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

type Tab = 'dashboard' | 'transactions' | 'tithe' | 'reports'

interface User { id: string; email: string; role: string; name: string }
interface Church { id: string; name: string; code: string }
interface Branch { id: string; name: string; code: string; church_id: string }
interface Transaction { id: string; type: string; category: string; amount: number; date: string; description: string }
interface Tithe { id: string; member_name: string; amount: number; date: string }
interface Member { id: string; name: string }
interface Category { id: string; name: string; type: string }

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
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

  // Form state
  const [txnType, setTxnType] = useState('income')
  const [txnCategory, setTxnCategory] = useState('')
  const [txnAmount, setTxnAmount] = useState('')
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0])
  const [txnDesc, setTxnDesc] = useState('')

  const [titheMember, setTitheMember] = useState('')
  const [titheAmount, setTitheAmount] = useState('')
  const [titheDate, setTitheDate] = useState(new Date().toISOString().split('T')[0])

  const [email, setEmail] = useState('dadenike51@gmail.com')
  const [password, setPassword] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setEmail(session.user.email ?? '')
    })
  }, [])

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount)
  }

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
        .from('profiles')
        .select('id, role, church_id, churches(id, name, code)')
        .eq('id', authData.user.id)
        .single()

      if (userError) throw new Error(`Profile error: ${userError.message}`)
      if (!userData || !userData.churches) throw new Error('User not linked to a church. Please contact admin.')

      const churchData = userData.churches as unknown as Church
      setUser({ id: userData.id, email: authData.user.email!, role: userData.role, name: authData.user.email!.split('@')[0] })
      setChurch(churchData)

      const { data: branches } = await supabase.from('branches').select('*').eq('church_id', churchData.id).limit(1)
      let branchData: Branch
      if (branches && branches.length > 0) {
        branchData = branches[0]
      } else {
        const { data: newBranch } = await supabase.from('branches').insert({ church_id: churchData.id, name: 'Main Branch', code: 'MAIN' }).select().single()
        branchData = newBranch!
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
    setTransactions(prev => [data, ...prev])
    setTxnCategory(''); setTxnAmount(''); setTxnDesc('')
    setTxnDate(new Date().toISOString().split('T')[0])
    alert('✅ Transaction added!')
  }

  async function deleteTransaction(id: string) {
    if (!confirm('Delete this transaction?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  async function addTithe() {
    if (!titheMember || !titheAmount || !titheDate) { alert('Please fill all fields'); return }
    const { data, error } = await supabase.from('tithe_records').insert({
      church_id: church!.id, branch_id: branch!.id,
      member_name: titheMember, amount: parseFloat(titheAmount),
      date: titheDate, recorded_by: user!.id
    }).select().single()
    if (error) { alert('Error: ' + error.message); return }
    setTithes(prev => [data, ...prev])
    setTitheAmount(''); setTitheMember('')
    alert('✅ Tithe recorded!')
  }

  async function deleteTithe(id: string) {
    if (!confirm('Delete this tithe record?')) return
    const { error } = await supabase.from('tithe_records').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setTithes(prev => prev.filter(t => t.id !== id))
  }

  async function addMember() {
    const name = prompt('Enter member name:')
    if (!name?.trim()) return
    const { data, error } = await supabase.from('members').insert({ church_id: church!.id, name: name.trim() }).select().single()
    if (error) { alert('Error: ' + error.message); return }
    setMembers(prev => [...prev, data])
    alert('✅ Member added!')
  }

  async function logout() {
    if (!confirm('Are you sure you want to logout?')) return
    await supabase.auth.signOut()
    setUser(null); setChurch(null); setBranch(null)
    setTransactions([]); setTithes([]); setMembers([]); setCategories([])
  }

  function getAllTimeStats() {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(String(t.amount)), 0)
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(String(t.amount)), 0)
    const totalTithes = tithes.reduce((s, t) => s + parseFloat(String(t.amount)), 0)
    return { income, expenses, balance: income - expenses, totalTithes }
  }

  function getMonthlyStats() {
    const now = new Date()
    const month = selectedMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const filtered = transactions.filter(t => t.date.startsWith(month))
    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(String(t.amount)), 0)
    const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(String(t.amount)), 0)
    return { income, expenses, balance: income - expenses, count: filtered.length }
  }

  function getMonthOptions() {
    const months = new Set<string>()
    transactions.forEach(t => months.add(t.date.substring(0, 7)))
    return Array.from(months).sort().reverse()
  }

  // ── LOGIN SCREEN ──
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        {loading && (
          <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-700 font-medium mt-4">Loading...</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-indigo-900 mb-2">🏛️ Canaan Baptist Church</h1>
            <p className="text-gray-600">Accounting System</p>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">🔐 Login</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                placeholder="your.email@church.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                placeholder="Enter password" />
            </div>
            <button onClick={login}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium">
              Login
            </button>
            {loginError && <p className="text-red-600 text-sm text-center">{loginError}</p>}
          </div>
        </div>
      </div>
    )
  }

  const allStats = getAllTimeStats()
  const monthStats = getMonthlyStats()
  const filteredCats = categories.filter(c => c.type === txnType)

  // ── MAIN APP ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-indigo-900">🏛️ {church?.name}</h1>
            <p className="text-gray-600 mt-1">Branch: {branch?.name} | User: {user.name} ({user.role})</p>
          </div>
          <button onClick={logout} className="px-6 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium">
            Logout
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white rounded-lg shadow-xl p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          {(['dashboard', 'transactions', 'tithe', 'reports'] as Tab[]).map(tab => (
            <button key={tab} onClick={() => setCurrentTab(tab)}
              className={`px-6 py-3 rounded-lg font-medium transition ${currentTab === tab ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {tab === 'dashboard' ? '📊 Dashboard' : tab === 'transactions' ? '💰 Transactions' : tab === 'tithe' ? '📖 Tithes' : '📈 Reports'}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard */}
      {currentTab === 'dashboard' && (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-xl p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Total Income</div>
              <div className="text-3xl font-bold">{formatCurrency(allStats.income)}</div>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-xl p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Total Expenses</div>
              <div className="text-3xl font-bold">{formatCurrency(allStats.expenses)}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-xl p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Balance</div>
              <div className="text-3xl font-bold">{formatCurrency(allStats.balance)}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-xl p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Total Tithes</div>
              <div className="text-3xl font-bold">{formatCurrency(allStats.totalTithes)}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 Quick Stats</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-gray-600 text-sm">Total Transactions</div>
                <div className="text-2xl font-bold text-blue-600">{transactions.length}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-gray-600 text-sm">Tithe Records</div>
                <div className="text-2xl font-bold text-green-600">{tithes.length}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-gray-600 text-sm">Members</div>
                <div className="text-2xl font-bold text-purple-600">{members.length}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transactions */}
      {currentTab === 'transactions' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">➕ Add Transaction</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select value={txnType} onChange={e => { setTxnType(e.target.value); setTxnCategory('') }}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select value={txnCategory} onChange={e => setTxnCategory(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none">
                  <option value="">Select category...</option>
                  {filteredCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₦)</label>
                <input type="number" value={txnAmount} onChange={e => setTxnAmount(e.target.value)} step="0.01"
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <input type="text" value={txnDesc} onChange={e => setTxnDesc(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                  placeholder="Optional notes..." />
              </div>
              <button onClick={addTransaction}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium text-lg">
                Add Transaction
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📋 All Transactions ({transactions.length})</h2>
            {transactions.length === 0
              ? <p className="text-center text-gray-500 py-8">No transactions yet</p>
              : <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {transactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <div className="flex-1">
                        <div className="font-medium">{t.category}</div>
                        <div className="text-sm text-gray-600">{t.date}</div>
                      </div>
                      <div className={`font-bold mr-2 ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(parseFloat(String(t.amount)))}
                      </div>
                      <button onClick={() => deleteTransaction(t.id)}
                        className="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm">🗑️</button>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* Tithes */}
      {currentTab === 'tithe' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">➕ Record Tithe</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Member</label>
                <select value={titheMember} onChange={e => setTitheMember(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none">
                  <option value="">Select member...</option>
                  <option value="Anonymous">Anonymous</option>
                  {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <button onClick={addMember} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                  + Add New Member
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₦)</label>
                <input type="number" value={titheAmount} onChange={e => setTitheAmount(e.target.value)} step="0.01"
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input type="date" value={titheDate} onChange={e => setTitheDate(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none" />
              </div>
              <button onClick={addTithe}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium text-lg">
                Record Tithe
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📖 Tithe Records ({tithes.length})</h2>
            {tithes.length === 0
              ? <p className="text-center text-gray-500 py-8">No tithe records yet</p>
              : <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {tithes.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <div>
                        <div className="font-medium text-gray-800">{t.member_name}</div>
                        <div className="text-sm text-gray-600">{t.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">{formatCurrency(parseFloat(String(t.amount)))}</div>
                        <button onClick={() => deleteTithe(t.id)} className="text-xs text-red-600 hover:text-red-800 mt-1">Delete</button>
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
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📈 Monthly Reports</h2>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none">
              <option value="">Current Month</option>
              {getMonthOptions().map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="p-6 bg-green-50 rounded-lg">
              <div className="text-gray-600 mb-2">Income</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(monthStats.income)}</div>
            </div>
            <div className="p-6 bg-red-50 rounded-lg">
              <div className="text-gray-600 mb-2">Expenses</div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(monthStats.expenses)}</div>
            </div>
            <div className="p-6 bg-blue-50 rounded-lg">
              <div className="text-gray-600 mb-2">Balance</div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(monthStats.balance)}</div>
            </div>
          </div>
          <div className="text-center text-gray-600">{monthStats.count} transactions this month</div>
        </div>
      )}
    </div>
  )
}
