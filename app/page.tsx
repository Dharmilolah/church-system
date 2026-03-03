'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'

const supabase = createClient(
  'https://isvqwielxbbmplwpzaob.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzdnF3aWVseGJibXBsd3B6YW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNDkyNzIsImV4cCI6MjA4MzYyNTI3Mn0.G3M9RZTfxyguC9-bt-HIVfCAgQR3c0epqfm4w_ureq4'
)

// ─── Types ───────────────────────────────────────────────────
type Role = 'super_admin' | 'admin' | 'accountant' | 'viewer'
type Tab = 'dashboard'|'transactions'|'tithes'|'budget'|'payroll'|'loans'|'members'|'branches'|'reports'|'audit'

interface AppUser { id: string; email: string; role: Role; name: string; church_id: string; branch_id: string | null }
interface Church { id: string; name: string }
interface Branch { id: string; name: string; church_id: string; address?: string; pastor_name?: string; phone?: string; code?: string }
interface Transaction { id: string; type: string; category: string; amount: number; date: string; description: string; branch_id: string; receipt_number?: string }
interface Tithe { id: string; member_name: string; amount: number; date: string; branch_id: string; notes?: string }
interface Member { id: string; name: string; email?: string; phone?: string; join_date?: string; branch_id?: string }
interface Category { id: string; name: string; type: string }
interface Budget { id: string; category: string; amount: number; period: string; period_type: string; branch_id: string }
interface Payroll { id: string; staff_name: string; role: string; basic_salary: number; allowances: number; deductions: number; net_salary: number; payment_date: string; payment_month: string; status: string; branch_id: string }
interface Loan { id: string; type: string; member_name: string; description?: string; total_amount: number; amount_paid: number; balance: number; due_date?: string; status: string; branch_id: string }
interface AuditLog { id: string; user_email: string; action: string; table_name: string; details: Record<string,unknown>; created_at: string }

const COLORS = ['#2563eb','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2','#be185d']
const fmt = (n: number) => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:0}).format(n||0)
const toNum = (v: unknown) => parseFloat(String(v||0))||0

// ─── Permission helpers ───────────────────────────────────────
const canWrite = (role: Role) => ['super_admin','admin','accountant'].includes(role)
const canAdmin = (role: Role) => ['super_admin','admin'].includes(role)
const isSuperAdmin = (role: Role) => role === 'super_admin'

// ─── Audit logger ─────────────────────────────────────────────
async function logAudit(user: AppUser, action: string, table: string, details: Record<string,unknown>) {
  await supabase.from('audit_log').insert({
    church_id: user.church_id, branch_id: user.branch_id,
    user_id: user.id, user_email: user.email,
    action, table_name: table, details
  })
}

// ═══════════════════════════════════════════════════════════════
export default function Home() {
  const [user, setUser] = useState<AppUser|null>(null)
  const [church, setChurch] = useState<Church|null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranch, setActiveBranch] = useState<Branch|null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(false)
  const [loginErr, setLoginErr] = useState('')
  const [email, setEmail] = useState('dadenike51@gmail.com')
  const [password, setPassword] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tithes, setTithes] = useState<Tithe[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // ── Login ────────────────────────────────────────────────────
  async function login() {
    if (!email||!password) { setLoginErr('Please enter email and password'); return }
    setLoading(true); setLoginErr('')
    try {
      const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) throw authErr

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('id, role, church_id, branch_id, full_name, churches(id, name)')
        .eq('id', auth.user.id)
        .single()
      if (profErr) throw new Error('Profile error: ' + profErr.message)
      if (!profile?.churches) throw new Error('User not linked to a church.')

      const churchData = profile.churches as unknown as Church
      const appUser: AppUser = {
        id: profile.id, email: auth.user.email!,
        role: (profile.role || 'viewer') as Role,
        name: profile.full_name || auth.user.email!.split('@')[0],
        church_id: profile.church_id,
        branch_id: profile.branch_id
      }
      setUser(appUser)
      setChurch(churchData)

      // Load branches
      const { data: branchData } = await supabase.from('branches').select('*').eq('church_id', churchData.id)
      const allBranches = branchData || []
      setBranches(allBranches)

      // Set active branch
      let active: Branch | null = null
      if (isSuperAdmin(appUser.role)) {
        active = allBranches[0] || null
      } else {
        active = allBranches.find(b => b.id === appUser.branch_id) || allBranches[0] || null
      }
      setActiveBranch(active)

      await logAudit(appUser, 'LOGIN', 'auth', { email })
      if (active) await loadData(appUser, churchData.id, active.id)

    } catch (err: unknown) {
      setLoginErr(err instanceof Error ? err.message : 'Login failed')
    } finally { setLoading(false) }
  }

  const loadData = useCallback(async (u: AppUser, churchId: string, branchId: string) => {
    const [txRes, tiRes, memRes, catRes, budRes, payRes, loanRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('branch_id', branchId).order('date', {ascending:false}),
      supabase.from('tithe_records').select('*').eq('branch_id', branchId).order('date', {ascending:false}),
      supabase.from('members').select('*').eq('church_id', churchId).order('name'),
      supabase.from('categories').select('*').eq('church_id', churchId),
      supabase.from('budgets').select('*').eq('branch_id', branchId),
      supabase.from('payroll').select('*').eq('branch_id', branchId).order('payment_date', {ascending:false}),
      supabase.from('loans_pledges').select('*').eq('branch_id', branchId).order('created_at', {ascending:false}),
    ])
    setTransactions(txRes.data||[])
    setTithes(tiRes.data||[])
    setMembers(memRes.data||[])
    const cats = catRes.data||[]
    if (cats.length === 0) {
      const defaults = [
        {name:'Tithe',type:'income',church_id:churchId},{name:'Offering',type:'income',church_id:churchId},
        {name:'Donation',type:'income',church_id:churchId},{name:'Project Fund',type:'income',church_id:churchId},
        {name:'Salaries',type:'expense',church_id:churchId},{name:'Rent',type:'expense',church_id:churchId},
        {name:'Utilities',type:'expense',church_id:churchId},{name:'Maintenance',type:'expense',church_id:churchId},
        {name:'Evangelism',type:'expense',church_id:churchId},{name:'Welfare',type:'expense',church_id:churchId},
      ]
      const {data: newCats} = await supabase.from('categories').insert(defaults).select()
      setCategories(newCats||[])
    } else setCategories(cats)
    setBudgets(budRes.data||[])
    setPayrolls(payRes.data||[])
    setLoans(loanRes.data||[])

    // Audit logs - super admin only
    if (isSuperAdmin(u.role)) {
      const { data: logs } = await supabase.from('audit_log').select('*').eq('church_id', churchId).order('created_at', {ascending:false}).limit(100)
      setAuditLogs(logs||[])
    }
  }, [])

  async function switchBranch(branch: Branch) {
    setActiveBranch(branch)
    if (user && church) await loadData(user, church.id, branch.id)
  }

  async function logout() {
    if (!confirm('Logout?')) return
    if (user) await logAudit(user, 'LOGOUT', 'auth', {})
    await supabase.auth.signOut()
    setUser(null); setChurch(null); setBranches([]); setActiveBranch(null)
    setTransactions([]); setTithes([]); setMembers([])
  }

  // ── Stats ─────────────────────────────────────────────────────
  const totalIncome = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+toNum(t.amount),0)
  const totalExpenses = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+toNum(t.amount),0)
  const totalTithes = tithes.reduce((s,t)=>s+toNum(t.amount),0)
  const balance = totalIncome - totalExpenses
  const totalPayroll = payrolls.filter(p=>p.status==='paid').reduce((s,p)=>s+toNum(p.net_salary),0)
  const activeLoans = loans.filter(l=>l.status==='active')
  const totalLoanBalance = activeLoans.reduce((s,l)=>s+toNum(l.balance),0)

  // Monthly chart data
  const monthlyData = (() => {
    const map: Record<string,{month:string,income:number,expenses:number}> = {}
    transactions.forEach(t => {
      const m = t.date?.substring(0,7)||''
      if (!map[m]) map[m] = {month:m,income:0,expenses:0}
      if (t.type==='income') map[m].income += toNum(t.amount)
      else map[m].expenses += toNum(t.amount)
    })
    return Object.values(map).sort((a,b)=>a.month.localeCompare(b.month)).slice(-6)
  })()

  // Category breakdown for pie
  const categoryData = (() => {
    const map: Record<string,number> = {}
    transactions.filter(t=>t.type==='income').forEach(t => {
      map[t.category] = (map[t.category]||0) + toNum(t.amount)
    })
    return Object.entries(map).map(([name,value])=>({name,value}))
  })()

  // ── LOGIN SCREEN ─────────────────────────────────────────────
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(135deg,#1e3370 0%,#2563eb 50%,#1e3370 100%)'}}>
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
            <p className="text-gray-700 font-medium">Signing in...</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🏛️</div>
          <h1 className="text-white text-3xl font-bold mb-1">Canaan Baptist Church</h1>
          <p className="text-blue-200 text-sm tracking-widest uppercase">Financial Management System</p>
        </div>
        <div className="card p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Sign In to Your Account</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Email Address</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••"/>
            </div>
            {loginErr && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{loginErr}</p>}
            <button onClick={login} className="btn-primary w-full py-3 text-base">Sign In →</button>
          </div>
        </div>
        <p className="text-center text-blue-200 text-xs mt-4">v2.0 · Secure Church Finance Platform</p>
      </div>
    </div>
  )

  const navItems: {id:Tab; label:string; icon:string; roles:Role[]}[] = [
    {id:'dashboard', label:'Dashboard', icon:'📊', roles:['super_admin','admin','accountant','viewer']},
    {id:'transactions', label:'Transactions', icon:'💰', roles:['super_admin','admin','accountant','viewer']},
    {id:'tithes', label:'Tithes & Offerings', icon:'📖', roles:['super_admin','admin','accountant','viewer']},
    {id:'budget', label:'Budget', icon:'📋', roles:['super_admin','admin','accountant']},
    {id:'payroll', label:'Payroll', icon:'👥', roles:['super_admin','admin']},
    {id:'loans', label:'Loans & Pledges', icon:'🤝', roles:['super_admin','admin','accountant']},
    {id:'members', label:'Members', icon:'👤', roles:['super_admin','admin','accountant','viewer']},
    {id:'branches', label:'Branches', icon:'🏢', roles:['super_admin','admin']},
    {id:'reports', label:'Reports', icon:'📈', roles:['super_admin','admin','accountant']},
    {id:'audit', label:'Audit Trail', icon:'🔍', roles:['super_admin']},
  ].filter(n => n.roles.includes(user.role))

  const roleBadge: Record<Role,string> = {
    super_admin:'badge badge-purple', admin:'badge badge-blue',
    accountant:'badge badge-green', viewer:'badge badge-yellow'
  }
  const roleLabel: Record<Role,string> = {
    super_admin:'Super Admin', admin:'Branch Admin', accountant:'Accountant', viewer:'View Only'
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── SIDEBAR ── */}
      <aside className={`${sidebarOpen?'w-64':'w-16'} transition-all duration-300 flex flex-col bg-gradient-to-b from-blue-900 to-blue-800 text-white flex-shrink-0`}>
        <div className="p-4 border-b border-blue-700 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🏛️</span>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{church?.name}</p>
              <p className="text-blue-300 text-xs truncate">{activeBranch?.name||'All Branches'}</p>
            </div>
          )}
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="ml-auto text-blue-300 hover:text-white flex-shrink-0">
            {sidebarOpen?'◀':'▶'}
          </button>
        </div>

        {/* Branch selector */}
        {sidebarOpen && isSuperAdmin(user.role) && branches.length > 1 && (
          <div className="p-3 border-b border-blue-700">
            <p className="text-blue-300 text-xs mb-2 uppercase tracking-wider">Active Branch</p>
            <select
              value={activeBranch?.id||''}
              onChange={e => {const b=branches.find(x=>x.id===e.target.value); if(b) switchBranch(b)}}
              className="w-full bg-blue-800 text-white text-sm rounded-lg px-3 py-2 border border-blue-600 outline-none"
            >
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${tab===item.id?'bg-white text-blue-900':'text-blue-200 hover:bg-blue-700 hover:text-white'}`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-700">
          {sidebarOpen && (
            <div className="mb-3">
              <p className="font-semibold text-sm">{user.name}</p>
              <span className={roleBadge[user.role]}>{roleLabel[user.role]}</span>
            </div>
          )}
          <button onClick={logout} className={`${sidebarOpen?'w-full':'w-8'} bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors`}>
            {sidebarOpen?'Sign Out':'×'}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{navItems.find(n=>n.id===tab)?.icon} {navItems.find(n=>n.id===tab)?.label}</h1>
            <p className="text-gray-400 text-sm">{activeBranch?.name} · {new Date().toLocaleDateString('en-NG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin(user.role) && branches.length > 1 && !sidebarOpen && (
              <select value={activeBranch?.id||''} onChange={e=>{const b=branches.find(x=>x.id===e.target.value);if(b)switchBranch(b)}}
                className="input w-40 text-sm">
                {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user.name[0].toUpperCase()}
            </div>
          </div>
        </div>

        <div className="p-6">
          {tab==='dashboard' && <Dashboard {...{transactions,tithes,members,budgets,payrolls,loans,totalIncome,totalExpenses,totalTithes,balance,totalPayroll,totalLoanBalance,monthlyData,categoryData,fmt,branches,activeBranch}}/>}
          {tab==='transactions' && <Transactions {...{transactions,setTransactions,categories,user,church,activeBranch,canWrite,logAudit,fmt,toNum}}/>}
          {tab==='tithes' && <Tithes {...{tithes,setTithes,members,user,church,activeBranch,canWrite,logAudit,fmt,toNum}}/>}
          {tab==='budget' && <BudgetTab {...{budgets,setBudgets,transactions,categories,user,activeBranch,canAdmin,fmt,toNum}}/>}
          {tab==='payroll' && <PayrollTab {...{payrolls,setPayrolls,user,activeBranch,canAdmin,logAudit,fmt,toNum}}/>}
          {tab==='loans' && <LoansTab {...{loans,setLoans,user,activeBranch,canWrite,logAudit,fmt,toNum}}/>}
          {tab==='members' && <MembersTab {...{members,setMembers,user,church,branches,canWrite,logAudit}}/>}
          {tab==='branches' && <BranchesTab {...{branches,setBranches,user,church,isSuperAdmin,logAudit}}/>}
          {tab==='reports' && <ReportsTab {...{transactions,tithes,payrolls,budgets,loans,branches,activeBranch,fmt,toNum,monthlyData}}/>}
          {tab==='audit' && <AuditTab logs={auditLogs}/>}
        </div>
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function Dashboard({transactions,tithes,members,budgets,totalIncome,totalExpenses,totalTithes,balance,totalPayroll,totalLoanBalance,monthlyData,categoryData,fmt,branches,activeBranch}: {
  transactions:Transaction[],tithes:Tithe[],members:Member[],budgets:Budget[],payrolls?:Payroll[],loans?:Loan[],
  totalIncome:number,totalExpenses:number,totalTithes:number,balance:number,totalPayroll:number,totalLoanBalance:number,
  monthlyData:unknown[],categoryData:unknown[],fmt:(n:number)=>string,branches:Branch[],activeBranch:Branch|null
}) {
  const recentTx = transactions.slice(0,5)
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const monthIncome = transactions.filter(t=>t.type==='income'&&t.date?.startsWith(thisMonth)).reduce((s,t)=>s+parseFloat(String(t.amount||0)),0)
  const monthExpenses = transactions.filter(t=>t.type==='expense'&&t.date?.startsWith(thisMonth)).reduce((s,t)=>s+parseFloat(String(t.amount||0)),0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Total Income',val:totalIncome,icon:'📈',from:'#16a34a',to:'#15803d'},
          {label:'Total Expenses',val:totalExpenses,icon:'📉',from:'#dc2626',to:'#b91c1c'},
          {label:'Net Balance',val:balance,icon:'💵',from:'#2563eb',to:'#1d4ed8'},
          {label:'Total Tithes',val:totalTithes,icon:'🙏',from:'#7c3aed',to:'#6d28d9'},
        ].map(c=>(
          <div key={c.label} className="stat-card" style={{background:`linear-gradient(135deg,${c.from},${c.to})`}}>
            <p className="text-white text-opacity-80 text-sm mb-1">{c.icon} {c.label}</p>
            <p className="text-white text-xl font-bold">{fmt(c.val)}</p>
          </div>
        ))}
      </div>

      {/* This month + other stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'This Month Income',val:monthIncome,color:'text-green-600',bg:'bg-green-50'},
          {label:'This Month Expenses',val:monthExpenses,color:'text-red-600',bg:'bg-red-50'},
          {label:'Payroll Paid',val:totalPayroll,color:'text-blue-600',bg:'bg-blue-50'},
          {label:'Outstanding Loans',val:totalLoanBalance,color:'text-orange-600',bg:'bg-orange-50'},
        ].map(c=>(
          <div key={c.label} className={`card p-4 ${c.bg}`}>
            <p className="text-gray-500 text-xs mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.color}`}>{fmt(c.val)}</p>
          </div>
        ))}
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Transactions',val:transactions.length,icon:'💳'},
          {label:'Members',val:members.length,icon:'👥'},
          {label:'Branches',val:branches.length,icon:'🏢'},
        ].map(c=>(
          <div key={c.label} className="card p-4 text-center">
            <p className="text-3xl mb-1">{c.icon}</p>
            <p className="text-2xl font-bold text-gray-800">{c.val}</p>
            <p className="text-gray-400 text-sm">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-4">Monthly Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData as Record<string,unknown>[]}>
              <XAxis dataKey="month" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}} tickFormatter={(v)=>`₦${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={(v:number)=>fmt(v)}/>
              <Legend/>
              <Bar dataKey="income" fill="#16a34a" name="Income" radius={[4,4,0,0]}/>
              <Bar dataKey="expenses" fill="#dc2626" name="Expenses" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-4">Income by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData as Record<string,unknown>[]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {(categoryData as {name:string,value:number}[]).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v:number)=>fmt(v)}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400">No data yet</div>}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-800 mb-4">Recent Transactions</h3>
        {recentTx.length===0 ? <p className="text-gray-400 text-center py-6">No transactions yet</p> : (
          <div className="space-y-2">
            {recentTx.map(t=>(
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${t.type==='income'?'bg-green-100 text-green-600':'bg-red-100 text-red-600'}`}>
                    {t.type==='income'?'↑':'↓'}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-800">{t.category}</p>
                    <p className="text-xs text-gray-400">{t.date}</p>
                  </div>
                </div>
                <span className={`font-bold text-sm ${t.type==='income'?'text-green-600':'text-red-600'}`}>{fmt(toNum(t.amount))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════════
function Transactions({transactions,setTransactions,categories,user,church,activeBranch,canWrite,logAudit,fmt,toNum}: {
  transactions:Transaction[],setTransactions:React.Dispatch<React.SetStateAction<Transaction[]>>,
  categories:Category[],user:AppUser,church:Church|null,activeBranch:Branch|null,
  canWrite:(r:Role)=>boolean,logAudit:(u:AppUser,a:string,t:string,d:Record<string,unknown>)=>Promise<void>,
  fmt:(n:number)=>string,toNum:(v:unknown)=>number
}) {
  const [type, setType] = useState('income')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [desc, setDesc] = useState('')
  const [receipt, setReceipt] = useState('')
  const [filter, setFilter] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')

  const filteredCats = categories.filter(c=>c.type===type)
  const filtered = transactions.filter(t => {
    const matchSearch = !filter || t.category.toLowerCase().includes(filter.toLowerCase()) || t.description?.toLowerCase().includes(filter.toLowerCase())
    const matchType = filterType==='all' || t.type===filterType
    const matchMonth = !filterMonth || t.date?.startsWith(filterMonth)
    return matchSearch && matchType && matchMonth
  })

  const totalFiltered = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+toNum(t.amount),0) - filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+toNum(t.amount),0)

  async function add() {
    if (!category||!amount||!date||!activeBranch||!church) { alert('Fill all required fields'); return }
    const { data, error } = await supabase.from('transactions').insert({
      church_id:church.id, branch_id:activeBranch.id, type, category,
      amount:parseFloat(amount), date, description:desc, receipt_number:receipt,
      added_by:user.id
    }).select().single()
    if (error) { alert('Error: '+error.message); return }
    setTransactions(p=>[data,...p])
    await logAudit(user,'CREATE','transactions',{type,category,amount,date})
    setCategory(''); setAmount(''); setDesc(''); setReceipt('')
    alert('✅ Transaction added!')
  }

  async function del(id: string) {
    if (!confirm('Delete this transaction?')) return
    const {error} = await supabase.from('transactions').delete().eq('id',id)
    if (error) { alert('Error: '+error.message); return }
    setTransactions(p=>p.filter(t=>t.id!==id))
    await logAudit(user,'DELETE','transactions',{id})
  }

  const months = Array.from(new Set(transactions.map(t=>t.date?.substring(0,7)||''))).sort().reverse()

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Form */}
      {canWrite(user.role) && (
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold text-gray-800 mb-4">➕ Add Transaction</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">TYPE</label>
              <div className="flex gap-2">
                {['income','expense'].map(t=>(
                  <button key={t} onClick={()=>{setType(t);setCategory('')}}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${type===t?(t==='income'?'border-green-500 bg-green-50 text-green-700':'border-red-500 bg-red-50 text-red-700'):'border-gray-200 text-gray-400'}`}>
                    {t==='income'?'↑ Income':'↓ Expense'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">CATEGORY *</label>
              <select className="input" value={category} onChange={e=>setCategory(e.target.value)}>
                <option value="">Select...</option>
                {filteredCats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">AMOUNT (₦) *</label>
              <input className="input" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">DATE *</label>
              <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">RECEIPT NO.</label>
              <input className="input" value={receipt} onChange={e=>setReceipt(e.target.value)} placeholder="Optional"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">DESCRIPTION</label>
              <input className="input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Optional notes..."/>
            </div>
            <button onClick={add} className="btn-primary w-full py-3">Add Transaction</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className={`${canWrite(user.role)?'lg:col-span-3':'lg:col-span-5'} card p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">All Transactions ({filtered.length})</h3>
          <span className={`font-bold text-sm ${totalFiltered>=0?'text-green-600':'text-red-600'}`}>{fmt(totalFiltered)}</span>
        </div>
        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <input className="input flex-1 min-w-32 text-sm" placeholder="Search..." value={filter} onChange={e=>setFilter(e.target.value)}/>
          <select className="input w-36 text-sm" value={filterType} onChange={e=>setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select className="input w-36 text-sm" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
            <option value="">All Months</option>
            {months.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {filtered.length===0 ? <p className="text-center text-gray-400 py-10">No transactions found</p> : filtered.map(t=>(
            <div key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${t.type==='income'?'bg-green-100 text-green-600':'bg-red-100 text-red-600'}`}>
                {t.type==='income'?'↑':'↓'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800">{t.category}</p>
                <p className="text-xs text-gray-400">{t.date} {t.receipt_number && `· Rcpt: ${t.receipt_number}`}</p>
                {t.description && <p className="text-xs text-gray-400 truncate">{t.description}</p>}
              </div>
              <span className={`font-bold text-sm flex-shrink-0 ${t.type==='income'?'text-green-600':'text-red-600'}`}>{fmt(toNum(t.amount))}</span>
              {canWrite(user.role) && <button onClick={()=>del(t.id)} className="btn-danger text-xs px-2 py-1">🗑</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TITHES
// ═══════════════════════════════════════════════════════════════
function Tithes({tithes,setTithes,members,user,church,activeBranch,canWrite,logAudit,fmt,toNum}: {
  tithes:Tithe[],setTithes:React.Dispatch<React.SetStateAction<Tithe[]>>,
  members:Member[],user:AppUser,church:Church|null,activeBranch:Branch|null,
  canWrite:(r:Role)=>boolean,logAudit:(u:AppUser,a:string,t:string,d:Record<string,unknown>)=>Promise<void>,
  fmt:(n:number)=>string,toNum:(v:unknown)=>number
}) {
  const [memberName, setMemberName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const filtered = tithes.filter(t=>{
    const ms = !search || t.member_name.toLowerCase().includes(search.toLowerCase())
    const mm = !filterMonth || t.date?.startsWith(filterMonth)
    return ms && mm
  })
  const total = filtered.reduce((s,t)=>s+toNum(t.amount),0)
  const months = Array.from(new Set(tithes.map(t=>t.date?.substring(0,7)||''))).sort().reverse()

  // Top givers
  const giverMap: Record<string,number> = {}
  tithes.forEach(t=>{ giverMap[t.member_name]=(giverMap[t.member_name]||0)+toNum(t.amount) })
  const topGivers = Object.entries(giverMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

  async function add() {
    if (!memberName||!amount||!date||!activeBranch||!church) { alert('Fill all fields'); return }
    const {data,error} = await supabase.from('tithe_records').insert({
      church_id:church.id, branch_id:activeBranch.id,
      member_name:memberName, amount:parseFloat(amount), date, notes, recorded_by:user.id
    }).select().single()
    if (error) { alert('Error: '+error.message); return }
    setTithes(p=>[data,...p])
    await logAudit(user,'CREATE','tithe_records',{memberName,amount,date})
    setAmount(''); setNotes('')
    alert('✅ Tithe recorded!')
  }

  async function del(id: string) {
    if (!confirm('Delete?')) return
    await supabase.from('tithe_records').delete().eq('id',id)
    setTithes(p=>p.filter(t=>t.id!==id))
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="stat-card" style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)'}}>
          <p className="text-white text-opacity-80 text-sm">Total Tithes Collected</p>
          <p className="text-white text-2xl font-bold">{fmt(tithes.reduce((s,t)=>s+toNum(t.amount),0))}</p>
        </div>
        <div className="stat-card" style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}}>
          <p className="text-white text-opacity-80 text-sm">This Month</p>
          <p className="text-white text-2xl font-bold">{fmt(tithes.filter(t=>t.date?.startsWith(new Date().toISOString().substring(0,7))).reduce((s,t)=>s+toNum(t.amount),0))}</p>
        </div>
        <div className="stat-card" style={{background:'linear-gradient(135deg,#16a34a,#15803d)'}}>
          <p className="text-white text-opacity-80 text-sm">Total Records</p>
          <p className="text-white text-2xl font-bold">{tithes.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {canWrite(user.role) && (
          <div className="lg:col-span-2 card p-5">
            <h3 className="font-bold text-gray-800 mb-4">📖 Record Tithe</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">MEMBER *</label>
                <input list="members-list" className="input" value={memberName} onChange={e=>setMemberName(e.target.value)} placeholder="Type or select member..."/>
                <datalist id="members-list">
                  <option value="Anonymous"/>
                  {members.map(m=><option key={m.id} value={m.name}/>)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">AMOUNT (₦) *</label>
                <input className="input" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">DATE *</label>
                <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">NOTES</label>
                <input className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional..."/>
              </div>
              <button onClick={add} className="btn-primary w-full py-3">Record Tithe</button>
            </div>
          </div>
        )}

        <div className={`${canWrite(user.role)?'lg:col-span-3':'lg:col-span-5'} space-y-4`}>
          <div className="card p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800">Tithe Records ({filtered.length})</h3>
              <span className="font-bold text-purple-600">{fmt(total)}</span>
            </div>
            <div className="flex gap-2 mb-3">
              <input className="input flex-1 text-sm" placeholder="Search member..." value={search} onChange={e=>setSearch(e.target.value)}/>
              <select className="input w-36 text-sm" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
                <option value="">All Months</option>
                {months.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filtered.map(t=>(
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{t.member_name}</p>
                    <p className="text-xs text-gray-400">{t.date} {t.notes && `· ${t.notes}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-600">{fmt(toNum(t.amount))}</span>
                    {canWrite(user.role) && <button onClick={()=>del(t.id)} className="btn-danger text-xs px-2 py-1">🗑</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {topGivers.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-gray-800 mb-3">🏆 Top Givers</h3>
              <div className="space-y-2">
                {topGivers.map(([name,amt],i)=>(
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">{i+1}</span>
                    <span className="flex-1 text-sm text-gray-700">{name}</span>
                    <span className="font-bold text-sm text-purple-600">{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// BUDGET
// ═══════════════════════════════════════════════════════════════
function BudgetTab({budgets,setBudgets,transactions,categories,user,activeBranch,canAdmin,fmt,toNum}: {
  budgets:Budget[],setBudgets:React.Dispatch<React.SetStateAction<Budget[]>>,
  transactions:Transaction[],categories:Category[],user:AppUser,activeBranch:Branch|null,
  canAdmin:(r:Role)=>boolean,fmt:(n:number)=>string,toNum:(v:unknown)=>number
}) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState(new Date().toISOString().substring(0,7))
  const [periodType, setPeriodType] = useState('monthly')

  async function add() {
    if (!category||!amount||!activeBranch) { alert('Fill all fields'); return }
    const {data,error} = await supabase.from('budgets').insert({
      church_id:user.church_id, branch_id:activeBranch.id,
      category, amount:parseFloat(amount), period, period_type:periodType, created_by:user.id
    }).select().single()
    if (error) { alert('Error: '+error.message); return }
    setBudgets(p=>[...p,data])
    setCategory(''); setAmount('')
    alert('✅ Budget set!')
  }

  async function del(id: string) {
    if (!confirm('Delete budget?')) return
    await supabase.from('budgets').delete().eq('id',id)
    setBudgets(p=>p.filter(b=>b.id!==id))
  }

  // Calculate spent vs budget
  const budgetWithSpent = budgets.map(b=>{
    const spent = transactions.filter(t=>t.type==='expense'&&t.category===b.category&&t.date?.startsWith(b.period)).reduce((s,t)=>s+toNum(t.amount),0)
    const pct = b.amount > 0 ? Math.min((spent/toNum(b.amount))*100,100) : 0
    return {...b, spent, pct}
  })

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {canAdmin(user.role) && (
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold text-gray-800 mb-4">📋 Set Budget</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">CATEGORY</label>
              <select className="input" value={category} onChange={e=>setCategory(e.target.value)}>
                <option value="">Select...</option>
                {categories.filter(c=>c.type==='expense').map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">BUDGET AMOUNT (₦)</label>
              <input className="input" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">PERIOD TYPE</label>
              <select className="input" value={periodType} onChange={e=>setPeriodType(e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">PERIOD</label>
              <input className="input" type="month" value={period} onChange={e=>setPeriod(e.target.value)}/>
            </div>
            <button onClick={add} className="btn-primary w-full py-3">Set Budget</button>
          </div>
        </div>
      )}

      <div className={`${canAdmin(user.role)?'lg:col-span-3':'lg:col-span-5'} card p-5`}>
        <h3 className="font-bold text-gray-800 mb-4">Budget vs Actual Spending</h3>
        {budgetWithSpent.length===0 ? <p className="text-gray-400 text-center py-10">No budgets set yet</p> : (
          <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
            {budgetWithSpent.map(b=>(
              <div key={b.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-semibold text-gray-800">{b.category}</p>
                    <p className="text-xs text-gray-400">{b.period} · {b.period_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{fmt(b.spent)} <span className="text-gray-400 font-normal">/ {fmt(toNum(b.amount))}</span></p>
                    {canAdmin(user.role) && <button onClick={()=>del(b.id)} className="btn-danger text-xs mt-1">Remove</button>}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${b.pct>=90?'bg-red-500':b.pct>=70?'bg-yellow-500':'bg-green-500'}`}
                    style={{width:`${b.pct}%`}}/>
                </div>
                <p className={`text-xs mt-1 font-medium ${b.pct>=90?'text-red-600':b.pct>=70?'text-yellow-600':'text-green-600'}`}>
                  {b.pct.toFixed(0)}% used · {fmt(toNum(b.amount)-b.spent)} remaining
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PAYROLL
// ═══════════════════════════════════════════════════════════════
function PayrollTab({payrolls,setPayrolls,user,activeBranch,canAdmin,logAudit,fmt,toNum}: {
  payrolls:Payroll[],setPayrolls:React.Dispatch<React.SetStateAction<Payroll[]>>,
  user:AppUser,activeBranch:Branch|null,canAdmin:(r:Role)=>boolean,
  logAudit:(u:AppUser,a:string,t:string,d:Record<string,unknown>)=>Promise<void>,
  fmt:(n:number)=>string,toNum:(v:unknown)=>number
}) {
  const [staffName, setStaffName] = useState('')
  const [role, setRole] = useState('')
  const [basic, setBasic] = useState('')
  const [allowances, setAllowances] = useState('0')
  const [deductions, setDeductions] = useState('0')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payMonth, setPayMonth] = useState(new Date().toISOString().substring(0,7))
  const [filterMonth, setFilterMonth] = useState('')

  const net = (parseFloat(basic)||0) + (parseFloat(allowances)||0) - (parseFloat(deductions)||0)
  const filtered = payrolls.filter(p=>!filterMonth||p.payment_month===filterMonth)
  const totalNet = filtered.reduce((s,p)=>s+toNum(p.net_salary),0)
  const months = Array.from(new Set(payrolls.map(p=>p.payment_month))).sort().reverse()

  async function add() {
    if (!staffName||!role||!basic||!activeBranch) { alert('Fill all required fields'); return }
    const {data,error} = await supabase.from('payroll').insert({
      church_id:user.church_id, branch_id:activeBranch.id,
      staff_name:staffName, role, basic_salary:parseFloat(basic),
      allowances:parseFloat(allowances)||0, deductions:parseFloat(deductions)||0,
      payment_date:payDate, payment_month:payMonth, status:'pending'
    }).select().single()
    if (error) { alert('Error: '+error.message); return }
    setPayrolls(p=>[data,...p])
    await logAudit(user,'CREATE','payroll',{staffName,role,basic})
    setStaffName(''); setRole(''); setBasic(''); setAllowances('0'); setDeductions('0')
    alert('✅ Payroll entry added!')
  }

  async function markPaid(id: string) {
    if (!confirm('Mark as paid?')) return
    const {data,error} = await supabase.from('payroll').update({status:'paid',paid_by:user.id}).eq('id',id).select().single()
    if (error) { alert('Error: '+error.message); return }
    setPayrolls(p=>p.map(x=>x.id===id?data:x))
    await logAudit(user,'UPDATE','payroll',{id,status:'paid'})
  }

  async function del(id: string) {
    if (!confirm('Delete?')) return
    await supabase.from('payroll').delete().eq('id',id)
    setPayrolls(p=>p.filter(x=>x.id!==id))
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {canAdmin(user.role) && (
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold text-gray-800 mb-4">👥 Add Payroll Entry</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">STAFF NAME *</label>
              <input className="input" value={staffName} onChange={e=>setStaffName(e.target.value)} placeholder="Full name"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ROLE / POSITION *</label>
              <input className="input" value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Pastor, Admin"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">BASIC SALARY (₦) *</label>
              <input className="input" type="number" value={basic} onChange={e=>setBasic(e.target.value)} placeholder="0.00"/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">ALLOWANCES (₦)</label>
                <input className="input" type="number" value={allowances} onChange={e=>setAllowances(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">DEDUCTIONS (₦)</label>
                <input className="input" type="number" value={deductions} onChange={e=>setDeductions(e.target.value)}/>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl text-center">
              <p className="text-xs text-gray-500">Net Salary</p>
              <p className="text-xl font-bold text-blue-700">{fmt(net)}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">PAYMENT MONTH</label>
              <input className="input" type="month" value={payMonth} onChange={e=>setPayMonth(e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">PAYMENT DATE</label>
              <input className="input" type="date" value={payDate} onChange={e=>setPayDate(e.target.value)}/>
            </div>
            <button onClick={add} className="btn-primary w-full py-3">Add Entry</button>
          </div>
        </div>
      )}

      <div className={`${canAdmin(user.role)?'lg:col-span-3':'lg:col-span-5'} card p-5`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800">Payroll Records</h3>
          <div className="flex items-center gap-2">
            <select className="input w-36 text-sm" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
              <option value="">All Months</option>
              {months.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 p-3 rounded-xl">
            <p className="text-xs text-gray-500">Total Net Payroll</p>
            <p className="font-bold text-blue-700">{fmt(totalNet)}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-xl">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="font-bold text-green-700">{fmt(filtered.filter(p=>p.status==='paid').reduce((s,p)=>s+toNum(p.net_salary),0))}</p>
          </div>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filtered.length===0 ? <p className="text-gray-400 text-center py-8">No payroll records</p> : filtered.map(p=>(
            <div key={p.id} className="p-3 bg-gray-50 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{p.staff_name}</p>
                  <p className="text-xs text-gray-400">{p.role} · {p.payment_month}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Basic: {fmt(toNum(p.basic_salary))} + Allow: {fmt(toNum(p.allowances))} - Ded: {fmt(toNum(p.deductions))}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">{fmt(toNum(p.net_salary))}</p>
                  <span className={`badge ${p.status==='paid'?'badge-green':'badge-yellow'} text-xs`}>{p.status}</span>
                </div>
              </div>
              {canAdmin(user.role) && p.status==='pending' && (
                <div className="flex gap-2 mt-2">
                  <button onClick={()=>markPaid(p.id)} className="btn-primary text-xs px-3 py-1">Mark Paid</button>
                  <button onClick={()=>del(p.id)} className="btn-danger text-xs px-3 py-1">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// LOANS & PLEDGES
// ═══════════════════════════════════════════════════════════════
function LoansTab({loans,setLoans,user,activeBranch,canWrite,logAudit,fmt,toNum}: {
  loans:Loan[],setLoans:React.Dispatch<React.SetStateAction<Loan[]>>,
  user:AppUser,activeBranch:Branch|null,canWrite:(r:Role)=>boolean,
  logAudit:(u:AppUser,a:string,t:string,d:Record<string,unknown>)=>Promise<void>,
  fmt:(n:number)=>string,toNum:(v:unknown)=>number
}) {
  const [type, setType] = useState('pledge')
  const [memberName, setMemberName] = useState('')
  const [desc, setDesc] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [paymentId, setPaymentId] = useState<string|null>(null)
  const [payAmount, setPayAmount] = useState('')

  async function add() {
    if (!memberName||!totalAmount||!activeBranch) { alert('Fill all fields'); return }
    const {data,error} = await supabase.from('loans_pledges').insert({
      church_id:user.church_id, branch_id:activeBranch.id,
      type, member_name:memberName, description:desc,
      total_amount:parseFloat(totalAmount), amount_paid:0,
      due_date:dueDate||null, status:'active', created_by:user.id
    }).select().single()
    if (error) { alert('Error: '+error.message); return }
    setLoans(p=>[data,...p])
    await logAudit(user,'CREATE','loans_pledges',{type,memberName,totalAmount})
    setMemberName(''); setDesc(''); setTotalAmount(''); setDueDate('')
    alert(`✅ ${type==='pledge'?'Pledge':'Loan'} recorded!`)
  }

  async function recordPayment(loan: Loan) {
    if (!payAmount || parseFloat(payAmount)<=0) { alert('Enter payment amount'); return }
    const newPaid = toNum(loan.amount_paid) + parseFloat(payAmount)
    const newStatus = newPaid >= toNum(loan.total_amount) ? 'completed' : 'active'
    const {data,error} = await supabase.from('loans_pledges').update({amount_paid:newPaid,status:newStatus}).eq('id',loan.id).select().single()
    if (error) { alert('Error: '+error.message); return }
    await supabase.from('loan_payments').insert({loan_id:loan.id,amount:parseFloat(payAmount),payment_date:new Date().toISOString().split('T')[0],recorded_by:user.id})
    setLoans(p=>p.map(l=>l.id===loan.id?data:l))
    setPaymentId(null); setPayAmount('')
    alert('✅ Payment recorded!')
  }

  const active = loans.filter(l=>l.status==='active')
  const completed = loans.filter(l=>l.status==='completed')

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {canWrite(user.role) && (
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold text-gray-800 mb-4">🤝 New Loan / Pledge</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">TYPE</label>
              <div className="flex gap-2">
                {['pledge','loan'].map(t=>(
                  <button key={t} onClick={()=>setType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all capitalize ${type===t?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 text-gray-400'}`}>
                    {t==='pledge'?'🙏 Pledge':'💸 Loan'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">MEMBER NAME *</label>
              <input className="input" value={memberName} onChange={e=>setMemberName(e.target.value)} placeholder="Full name"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">DESCRIPTION</label>
              <input className="input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Purpose..."/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">TOTAL AMOUNT (₦) *</label>
              <input className="input" type="number" value={totalAmount} onChange={e=>setTotalAmount(e.target.value)} placeholder="0.00"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">DUE DATE</label>
              <input className="input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
            </div>
            <button onClick={add} className="btn-primary w-full py-3">Record {type==='pledge'?'Pledge':'Loan'}</button>
          </div>
        </div>
      )}

      <div className={`${canWrite(user.role)?'lg:col-span-3':'lg:col-span-5'} space-y-4`}>
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-400">Active</p>
            <p className="font-bold text-blue-700 text-lg">{active.length}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-400">Outstanding</p>
            <p className="font-bold text-red-600 text-lg">{fmt(active.reduce((s,l)=>s+toNum(l.balance),0))}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-400">Completed</p>
            <p className="font-bold text-green-600 text-lg">{completed.length}</p>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-3">Active Loans & Pledges</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {active.length===0 ? <p className="text-gray-400 text-center py-6">None active</p> : active.map(l=>(
              <div key={l.id} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${l.type==='pledge'?'badge-purple':'badge-blue'} text-xs`}>{l.type}</span>
                      <p className="font-semibold text-sm text-gray-800">{l.member_name}</p>
                    </div>
                    {l.description && <p className="text-xs text-gray-400">{l.description}</p>}
                    {l.due_date && <p className="text-xs text-gray-400">Due: {l.due_date}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Total: {fmt(toNum(l.total_amount))}</p>
                    <p className="text-xs text-green-600">Paid: {fmt(toNum(l.amount_paid))}</p>
                    <p className="font-bold text-red-600 text-sm">Balance: {fmt(toNum(l.balance))}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                  <div className="h-1.5 bg-green-500 rounded-full" style={{width:`${Math.min((toNum(l.amount_paid)/toNum(l.total_amount))*100,100)}%`}}/>
                </div>
                {canWrite(user.role) && (
                  paymentId===l.id ? (
                    <div className="flex gap-2">
                      <input className="input flex-1 text-sm py-1" type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="Amount..."/>
                      <button onClick={()=>recordPayment(l)} className="btn-primary text-xs px-3 py-1">Pay</button>
                      <button onClick={()=>setPaymentId(null)} className="btn-danger text-xs px-3 py-1">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={()=>setPaymentId(l.id)} className="btn-primary text-xs px-3 py-1">Record Payment</button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MEMBERS
// ═══════════════════════════════════════════════════════════════
function MembersTab({members,setMembers,user,church,branches,canWrite,logAudit}: {
  members:Member[],setMembers:React.Dispatch<React.SetStateAction<Member[]>>,
  user:AppUser,church:Church|null,branches:Branch[],
  canWrite:(r:Role)=>boolean,logAudit:(u:AppUser,a:string,t:string,d:Record<string,unknown>)=>Promise<void>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [joinDate, setJoinDate] = useState('')
  const [branchId, setBranchId] = useState(user.branch_id||'')
  const [search, setSearch] = useState('')

  const filtered = members.filter(m=>!search||m.name.toLowerCase().includes(search.toLowerCase())||m.email?.toLowerCase().includes(search.toLowerCase()))

  async function add() {
    if (!name||!church) { alert('Enter member name'); return }
    const {data,error} = await supabase.from('members').insert({
      church_id:church.id, name, email:email||null,
      phone:phone||null, join_date:joinDate||null, branch_id:branchId||null
    }).select().single()
    if (error) { alert('Error: '+error.message); return }
    setMembers(p=>[...p,data])
    await logAudit(user,'CREATE','members',{name})
    setName(''); setEmail(''); setPhone(''); setJoinDate('')
    alert('✅ Member added!')
  }

  async function del(id: string) {
    if (!confirm('Delete member?')) return
    await supabase.from('members').delete().eq('id',id)
    setMembers(p=>p.filter(m=>m.id!==id))
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {canWrite(user.role) && (
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold text-gray-800 mb-4">👤 Add Member</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">FULL NAME *</label>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">EMAIL</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="optional"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">PHONE</label>
              <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="optional"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">JOIN DATE</label>
              <input className="input" type="date" value={joinDate} onChange={e=>setJoinDate(e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">BRANCH</label>
              <select className="input" value={branchId} onChange={e=>setBranchId(e.target.value)}>
                <option value="">Select branch...</option>
                {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <button onClick={add} className="btn-primary w-full py-3">Add Member</button>
          </div>
        </div>
      )}

      <div className={`${canWrite(user.role)?'lg:col-span-3':'lg:col-span-5'} card p-5`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800">Members ({filtered.length})</h3>
        </div>
        <input className="input mb-4 text-sm" placeholder="Search by name or email..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {filtered.length===0 ? <p className="text-gray-400 text-center py-8">No members found</p> : filtered.map(m=>(
            <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {m.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800">{m.name}</p>
                <p className="text-xs text-gray-400">{m.email||''} {m.phone?`· ${m.phone}`:''}</p>
                {m.join_date && <p className="text-xs text-gray-400">Joined: {m.join_date}</p>}
              </div>
              {canWrite(user.role) && <button onClick={()=>del(m.id)} className="btn-danger text-xs px-2 py-1">🗑</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// BRANCHES
// ═══════════════════════════════════════════════════════════════
function BranchesTab({branches,setBranches,user,church,isSuperAdmin,logAudit}: {
  branches:Branch[],setBranches:React.Dispatch<React.SetStateAction<Branch[]>>,
  user:AppUser,church:Church|null,isSuperAdmin:(r:Role)=>boolean,
  logAudit:(u:AppUser,a:string,t:string,d:Record<string,unknown>)=>Promise<void>
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [pastor, setPastor] = useState('')
  const [phone, setPhone] = useState('')

  async function add() {
    if (!name||!church) { alert('Enter branch name'); return }
    const {data,error} = await supabase.from('branches').insert({
      church_id:church.id, name, address:address||null,
      pastor_name:pastor||null, phone:phone||null
    }).select().single()
    if (error) { alert('Error: '+error.message); return }
    setBranches(p=>[...p,data])
    await logAudit(user,'CREATE','branches',{name})
    setName(''); setAddress(''); setPastor(''); setPhone('')
    alert('✅ Branch created!')
  }

  async function del(id: string) {
    if (!confirm('Delete this branch? All its data will be affected.')) return
    const {error} = await supabase.from('branches').delete().eq('id',id)
    if (error) { alert('Error: '+error.message); return }
    setBranches(p=>p.filter(b=>b.id!==id))
    await logAudit(user,'DELETE','branches',{id})
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {isSuperAdmin(user.role) && (
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold text-gray-800 mb-4">🏢 Create New Branch</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">BRANCH NAME *</label>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Victoria Island Branch"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">PASTOR / LEADER</label>
              <input className="input" value={pastor} onChange={e=>setPastor(e.target.value)} placeholder="Pastor's name"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ADDRESS</label>
              <input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Branch address"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">PHONE</label>
              <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Contact number"/>
            </div>
            <button onClick={add} className="btn-primary w-full py-3">Create Branch</button>
          </div>
        </div>
      )}

      <div className={`${isSuperAdmin(user.role)?'lg:col-span-3':'lg:col-span-5'} card p-5`}>
        <h3 className="font-bold text-gray-800 mb-4">All Branches ({branches.length})</h3>
        <div className="space-y-3">
          {branches.length===0 ? <p className="text-gray-400 text-center py-8">No branches yet</p> : branches.map(b=>(
            <div key={b.id} className="p-4 bg-gray-50 rounded-xl border-l-4 border-blue-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-800">{b.name}</p>
                  {b.pastor_name && <p className="text-sm text-gray-600">👤 {b.pastor_name}</p>}
                  {b.address && <p className="text-sm text-gray-500">📍 {b.address}</p>}
                  {b.phone && <p className="text-sm text-gray-500">📞 {b.phone}</p>}
                </div>
                {isSuperAdmin(user.role) && (
                  <button onClick={()=>del(b.id)} className="btn-danger text-xs">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════
function ReportsTab({transactions,tithes,payrolls,budgets,loans,branches,activeBranch,fmt,toNum,monthlyData}: {
  transactions:Transaction[],tithes:Tithe[],payrolls:Payroll[],budgets:Budget[],loans:Loan[],
  branches:Branch[],activeBranch:Branch|null,fmt:(n:number)=>string,toNum:(v:unknown)=>number,
  monthlyData:unknown[]
}) {
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0,7))

  const monthTx = transactions.filter(t=>t.date?.startsWith(reportMonth))
  const monthIncome = monthTx.filter(t=>t.type==='income').reduce((s,t)=>s+toNum(t.amount),0)
  const monthExpenses = monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+toNum(t.amount),0)
  const monthTithes = tithes.filter(t=>t.date?.startsWith(reportMonth)).reduce((s,t)=>s+toNum(t.amount),0)
  const monthPayroll = payrolls.filter(p=>p.payment_month===reportMonth).reduce((s,p)=>s+toNum(p.net_salary),0)

  // Income breakdown by category
  const incomeByCat: Record<string,number> = {}
  monthTx.filter(t=>t.type==='income').forEach(t=>{ incomeByCat[t.category]=(incomeByCat[t.category]||0)+toNum(t.amount) })
  const expByCat: Record<string,number> = {}
  monthTx.filter(t=>t.type==='expense').forEach(t=>{ expByCat[t.category]=(expByCat[t.category]||0)+toNum(t.amount) })

  // Branch comparison
  const branchComparison = branches.map(b=>({
    name: b.name,
    income: transactions.filter(t=>t.branch_id===b.id&&t.type==='income').reduce((s,t)=>s+toNum(t.amount),0),
    expenses: transactions.filter(t=>t.branch_id===b.id&&t.type==='expense').reduce((s,t)=>s+toNum(t.amount),0),
  }))

  function exportCSV() {
    const rows = [
      ['Date','Type','Category','Amount','Description'],
      ...monthTx.map(t=>[t.date,t.type,t.category,t.amount,t.description||''])
    ]
    const csv = rows.map(r=>r.join(',')).join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `report-${reportMonth}.csv`; a.click()
  }

  function printReport() {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">REPORT MONTH</label>
          <input className="input w-44" type="month" value={reportMonth} onChange={e=>setReportMonth(e.target.value)}/>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={exportCSV} className="btn-primary flex items-center gap-1">📥 Export CSV</button>
          <button onClick={printReport} className="btn-primary flex items-center gap-1" style={{background:'#16a34a'}}>🖨️ Print Report</button>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Income',val:monthIncome,color:'from-green-500 to-green-600'},
          {label:'Expenses',val:monthExpenses,color:'from-red-500 to-red-600'},
          {label:'Net',val:monthIncome-monthExpenses,color:'from-blue-500 to-blue-600'},
          {label:'Tithes',val:monthTithes,color:'from-purple-500 to-purple-600'},
        ].map(c=>(
          <div key={c.label} className={`stat-card bg-gradient-to-br ${c.color}`}>
            <p className="text-white text-opacity-80 text-sm">{c.label}</p>
            <p className="text-white text-xl font-bold">{fmt(c.val)}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Income by category */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-3">Income by Category — {reportMonth}</h3>
          {Object.keys(incomeByCat).length===0 ? <p className="text-gray-400 text-sm">No income data</p> : (
            <div className="space-y-2">
              {Object.entries(incomeByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                <div key={cat} className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                  <span className="text-sm text-gray-700">{cat}</span>
                  <span className="font-bold text-green-600 text-sm">{fmt(amt)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center p-2 bg-green-100 rounded-lg font-bold">
                <span className="text-sm">Total</span>
                <span className="text-green-700">{fmt(monthIncome)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Expenses by category */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-3">Expenses by Category — {reportMonth}</h3>
          {Object.keys(expByCat).length===0 ? <p className="text-gray-400 text-sm">No expense data</p> : (
            <div className="space-y-2">
              {Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                <div key={cat} className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-700">{cat}</span>
                  <span className="font-bold text-red-600 text-sm">{fmt(amt)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center p-2 bg-red-100 rounded-lg font-bold">
                <span className="text-sm">Total</span>
                <span className="text-red-700">{fmt(monthExpenses)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trend chart */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-800 mb-4">6-Month Trend</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyData as Record<string,unknown>[]}>
            <XAxis dataKey="month" tick={{fontSize:11}}/>
            <YAxis tick={{fontSize:11}} tickFormatter={(v)=>`₦${(v/1000).toFixed(0)}k`}/>
            <Tooltip formatter={(v:number)=>fmt(v)}/>
            <Legend/>
            <Line type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={2} name="Income" dot={false}/>
            <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} name="Expenses" dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Branch comparison */}
      {branches.length > 1 && (
        <div className="card p-5">
          <h3 className="font-bold text-gray-800 mb-4">Branch Comparison (All Time)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={branchComparison}>
              <XAxis dataKey="name" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}} tickFormatter={(v)=>`₦${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={(v:number)=>fmt(v)}/>
              <Legend/>
              <Bar dataKey="income" fill="#16a34a" name="Income" radius={[4,4,0,0]}/>
              <Bar dataKey="expenses" fill="#dc2626" name="Expenses" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Payroll summary */}
      <div className="card p-5">
        <h3 className="font-bold text-gray-800 mb-3">Payroll — {reportMonth}</h3>
        {payrolls.filter(p=>p.payment_month===reportMonth).length===0
          ? <p className="text-gray-400 text-sm">No payroll this month</p>
          : (
            <div className="space-y-2">
              {payrolls.filter(p=>p.payment_month===reportMonth).map(p=>(
                <div key={p.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.staff_name}</p>
                    <p className="text-xs text-gray-400">{p.role}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${p.status==='paid'?'badge-green':'badge-yellow'} text-xs`}>{p.status}</span>
                    <span className="font-bold text-sm text-gray-800">{fmt(toNum(p.net_salary))}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between p-2 bg-blue-50 rounded-lg font-bold">
                <span className="text-sm">Total Payroll</span>
                <span className="text-blue-700">{fmt(monthPayroll)}</span>
              </div>
            </div>
          )
        }
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════
function AuditTab({logs}: {logs:AuditLog[]}) {
  const [search, setSearch] = useState('')
  const filtered = logs.filter(l=>
    !search ||
    l.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.table_name?.toLowerCase().includes(search.toLowerCase())
  )

  const actionColor: Record<string,string> = {
    CREATE:'badge-green', DELETE:'badge-red', UPDATE:'badge-blue',
    LOGIN:'badge-purple', LOGOUT:'badge-yellow'
  }

  return (
    <div className="card p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-800">🔍 Audit Trail ({filtered.length} entries)</h3>
      </div>
      <input className="input mb-4 text-sm" placeholder="Search by user, action, or table..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
        {filtered.length===0 ? <p className="text-gray-400 text-center py-8">No audit logs</p> : filtered.map(log=>(
          <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <span className={`badge ${actionColor[log.action]||'badge-blue'} text-xs flex-shrink-0 mt-0.5`}>{log.action}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-800">{log.user_email}</p>
                {log.table_name && <span className="text-xs text-gray-400">on {log.table_name}</span>}
              </div>
              {log.details && Object.keys(log.details).length>0 && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{JSON.stringify(log.details)}</p>
              )}
            </div>
            <p className="text-xs text-gray-400 flex-shrink-0">{new Date(log.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
