'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  HardDrive,
  Activity,
  ShieldCheck,
  Search,
  RefreshCw,
  ArrowLeft,
  Server,
  Mail,
  Edit2,
  Trash2,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  Loader2,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import { api, User } from '@/lib/api'
import { useToast } from '@/components/toast'
import { cn } from '@/lib/utils'

type AdminTab = 'overview' | 'users' | 'storage' | 'diagnostics'

export default function AdminDashboardPage() {
  const router = useRouter()
  const { showSuccess, showError } = useToast()

  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Metrics State
  const [metrics, setMetrics] = useState<{
    total_users: number
    new_users_week: number
    active_users: number
    suspended_users: number
    plans: { free: number; pro: number; enterprise: number }
    total_accounts: number
    total_emails: number
    unread_emails: number
    total_storage_mb: number
  } | null>(null)

  const [serverInfo, setServerInfo] = useState<{
    php_version: string
    laravel_version: string
    server_os: string
    server_time: string
    memory_usage: string
    server_load: number[]
    socket_extension: boolean
    openssl_extension: boolean
  } | null>(null)

  const [recentUsers, setRecentUsers] = useState<User[]>([])

  // Users Tab State
  const [users, setUsers] = useState<User[]>([])
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    role: 'user',
    plan: 'free',
    status: 'active',
    max_storage_mb: 1000,
    max_accounts: 1,
    ai_credits_remaining: 50,
  })
  const [savingUser, setSavingUser] = useState(false)

  // Impersonate Confirmation State
  const [impersonatingUser, setImpersonatingUser] = useState<User | null>(null)
  const [impersonating, setImpersonating] = useState(false)

  // Diagnostics State
  const [diagType, setDiagType] = useState<'imap' | 'smtp'>('imap')
  const [diagHost, setDiagHost] = useState('mail.ownsoftwaresolutions.com')
  const [diagPort, setDiagPort] = useState(993)
  const [diagEncryption, setDiagEncryption] = useState('ssl')
  const [diagUsername, setDiagUsername] = useState('hello@sudhirrajai.com')
  const [diagPassword, setDiagPassword] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null)

  // Verify Admin Access and Load Initial Metrics
  useEffect(() => {
    async function initAdmin() {
      try {
        const token = api.getToken()
        if (!token) {
          router.replace('/login')
          return
        }

        let userObj: User | null = null
        const res = await api.getMe()
        if (res && res.user) {
          userObj = res.user
        }

        if (!userObj) {
          const raw = localStorage.getItem('mosaic_cached_user')
          if (raw) {
            try {
              userObj = JSON.parse(raw)
            } catch (e) {}
          }
        }

        if (!userObj) {
          router.replace('/login')
          return
        }

        if (!userObj.is_admin && userObj.role !== 'admin') {
          showError('Access Denied', 'Administrator privileges are required to access this dashboard.')
          router.replace('/mail')
          return
        }

        setCurrentUser(userObj)
        await loadMetrics()
      } catch (err: any) {
        showError('Session Error', err.message || 'Unable to authenticate admin session.')
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }

    initAdmin()
  }, [])

  // Load Metrics
  const loadMetrics = async () => {
    try {
      setRefreshing(true)
      const data = await api.getAdminMetrics()
      setMetrics(data.metrics)
      setServerInfo(data.server)
      setRecentUsers(data.recent_users)
    } catch (err: any) {
      showError('Metrics Error', err.message || 'Failed to load dashboard metrics.')
    } finally {
      setRefreshing(false)
    }
  }

  // Load Users
  const loadUsers = async (page = 1) => {
    try {
      setLoadingUsers(true)
      const res = await api.getAdminUsers({
        search: searchQuery,
        plan: planFilter,
        status: statusFilter,
        page,
      })
      setUsers(res.users.data)
      setUsersPage(res.users.current_page)
      setUsersTotalPages(res.users.last_page)
      setUsersTotal(res.users.total)
    } catch (err: any) {
      showError('Users Load Error', err.message || 'Failed to fetch users list.')
    } finally {
      setLoadingUsers(false)
    }
  }

  // Reload users when filter or search changes
  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'storage') {
      loadUsers(1)
    }
  }, [activeTab, planFilter, statusFilter])

  // Handle User Edit Submit
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      setSavingUser(true)
      await api.updateAdminUser(editingUser.id, editFormData as any)
      showSuccess('User Updated', `Successfully updated profile for ${editingUser.email}`)
      setEditingUser(null)
      loadUsers(usersPage)
      loadMetrics()
    } catch (err: any) {
      showError('Update Failed', err.message || 'Could not update user.')
    } finally {
      setSavingUser(false)
    }
  }

  // Handle Delete User
  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to permanently delete user "${user.name}" (${user.email}) and all their email accounts and emails? This cannot be undone.`)) {
      return
    }

    try {
      await api.deleteAdminUser(user.id)
      showSuccess('User Deleted', `User ${user.email} has been removed.`)
      loadUsers(usersPage)
      loadMetrics()
    } catch (err: any) {
      showError('Delete Failed', err.message || 'Could not delete user.')
    }
  }

  // Handle Impersonation
  const handleImpersonate = async () => {
    if (!impersonatingUser) return

    try {
      setImpersonating(true)
      const res = await api.impersonateUser(impersonatingUser.id)
      showSuccess('Impersonating User', `Switched to ${impersonatingUser.name}. Opening webmail view...`)
      
      // Save impersonation token and redirect
      api.setToken(res.token)
      localStorage.setItem('mosaic_cached_user', JSON.stringify(res.user))
      localStorage.removeItem('mosaic_cached_accounts')
      
      setTimeout(() => {
        router.push('/mail')
      }, 600)
    } catch (err: any) {
      showError('Impersonation Failed', err.message || 'Could not impersonate user.')
      setImpersonating(false)
      setImpersonatingUser(null)
    }
  }

  // Handle Connection Test
  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault()
    setTestingConnection(true)
    setTestResult(null)

    try {
      const res = await api.testAdminConnection({
        type: diagType,
        host: diagHost,
        port: Number(diagPort),
        encryption: diagEncryption,
        username: diagUsername,
        password: diagPassword,
      })
      setTestResult(res)
      if (res.success) {
        showSuccess('Diagnostic Passed', res.message)
      } else {
        showError('Diagnostic Failed', res.message)
      }
    } catch (err: any) {
      const msg = err.message || 'Diagnostic socket connection failed.'
      setTestResult({ success: false, message: msg })
      showError('Test Failed', msg)
    } finally {
      setTestingConnection(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Authenticating admin privileges...</p>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border/70 bg-card/60 backdrop-blur-xl flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-5 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Mosaic Admin</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">SaaS Control Center</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 flex-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer',
              activeTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Activity className="size-4" /> Overview & Metrics
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer',
              activeTab === 'users'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Users className="size-4" /> Users & Plans ({metrics?.total_users || 0})
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer',
              activeTab === 'storage'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <HardDrive className="size-4" /> Storage & Quotas
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer',
              activeTab === 'diagnostics'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Server className="size-4" /> Mail Server Diagnostics
          </button>
        </nav>

        {/* Back to Webmail Button */}
        <div className="p-4 border-t border-border/70 space-y-2">
          <button
            onClick={() => router.push('/mail')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
          >
            <ArrowLeft className="size-3.5" /> Back to Webmail Client
          </button>

          {currentUser && (
            <div className="flex items-center gap-2.5 rounded-xl bg-card p-2 border border-border/60">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold text-xs uppercase">
                {currentUser.name ? currentUser.name.substring(0, 2) : 'AD'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{currentUser.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{currentUser.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top App Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-8 backdrop-blur-xl">
          <div>
            <h2 className="text-base font-bold capitalize">
              {activeTab === 'overview' && 'System Overview & Platform Analytics'}
              {activeTab === 'users' && 'SaaS User Accounts & Plan Management'}
              {activeTab === 'storage' && 'Storage Consumption & Quotas'}
              {activeTab === 'diagnostics' && 'Protocol Connection Tester (IMAP / SMTP)'}
            </h2>
            <p className="text-xs text-muted-foreground">Real-time telemetry and management controls for Mosaic SaaS Webmail</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadMetrics()
                if (activeTab === 'users' || activeTab === 'storage') loadUsers(usersPage)
              }}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} /> Refresh
            </button>
          </div>
        </header>

        {/* Tab 1: Overview & Metrics */}
        {activeTab === 'overview' && (
          <div className="p-8 space-y-8">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Total Users</span>
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Users className="size-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold">{metrics?.total_users || 0}</span>
                  <span className="text-xs text-emerald-500 font-semibold flex items-center">
                    <TrendingUp className="size-3 mr-0.5" /> +{metrics?.new_users_week || 0} this week
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {metrics?.active_users || 0} active &middot; {metrics?.suspended_users || 0} suspended
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Connected Mailboxes</span>
                  <div className="rounded-xl bg-sky-500/10 p-2 text-sky-500">
                    <Server className="size-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold">{metrics?.total_accounts || 0}</span>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Active IMAP/SMTP Gateway integrations
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Synced Emails</span>
                  <div className="rounded-xl bg-violet-500/10 p-2 text-violet-500">
                    <Mail className="size-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold">{metrics?.total_emails || 0}</span>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {metrics?.unread_emails || 0} unread across all mailboxes
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Database Storage</span>
                  <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500">
                    <HardDrive className="size-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold">{metrics?.total_storage_mb || 0} MB</span>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Message bodies, headers & caches
                </div>
              </div>
            </div>

            {/* Plan Distribution & Server Health Section */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Plan Distribution */}
              <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Subscription Tier Distribution</h3>
                  <span className="text-xs font-semibold text-muted-foreground">SaaS Plans</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-slate-400" /> Free Tier
                      </span>
                      <span>{metrics?.plans.free || 0} users</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full"
                        style={{
                          width: `${metrics?.total_users ? ((metrics.plans.free / metrics.total_users) * 100).toFixed(0) : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-primary" /> Pro Plan ($12/mo)
                      </span>
                      <span>{metrics?.plans.pro || 0} users</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${metrics?.total_users ? ((metrics.plans.pro / metrics.total_users) * 100).toFixed(0) : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500" /> Enterprise ($49/mo)
                      </span>
                      <span>{metrics?.plans.enterprise || 0} users</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${metrics?.total_users ? ((metrics.plans.enterprise / metrics.total_users) * 100).toFixed(0) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Zap className="size-4 text-amber-400 shrink-0" />
                  <span>Stripe & Razorpay payment webhooks will auto-upgrade accounts.</span>
                </div>
              </div>

              {/* Server Diagnostics Overview */}
              <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl space-y-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Cpu className="size-4 text-primary" /> Server Runtime Environment
                  </h3>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Operational
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-muted-foreground block text-[11px]">PHP Runtime</span>
                    <span className="font-bold text-foreground mt-0.5 block">{serverInfo?.php_version || '8.3'}</span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-muted-foreground block text-[11px]">Laravel Framework</span>
                    <span className="font-bold text-foreground mt-0.5 block">{serverInfo?.laravel_version || '11.x'}</span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-muted-foreground block text-[11px]">Operating System</span>
                    <span className="font-bold text-foreground mt-0.5 block">{serverInfo?.server_os || 'Linux'}</span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-muted-foreground block text-[11px]">Memory Consumed</span>
                    <span className="font-bold text-foreground mt-0.5 block">{serverInfo?.memory_usage || '18 MB'}</span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-muted-foreground block text-[11px]">IMAP Sockets Extension</span>
                    <span className="font-bold text-emerald-500 mt-0.5 block flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Enabled
                    </span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-muted-foreground block text-[11px]">OpenSSL (TLS/SSL)</span>
                    <span className="font-bold text-emerald-500 mt-0.5 block flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Enabled
                    </span>
                  </div>
                </div>

                {/* Recent Registrations Table */}
                <div className="pt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Recent Customer Signups</h4>
                  <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/60 text-xs">
                    {recentUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-2.5 hover:bg-muted/30 transition">
                        <div className="flex items-center gap-2">
                          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-[10px]">
                            {u.name ? u.name.substring(0, 2).toUpperCase() : 'US'}
                          </div>
                          <span className="font-semibold">{u.name}</span>
                          <span className="text-muted-foreground">({u.email})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                            u.plan === 'enterprise' && 'bg-emerald-500/15 text-emerald-500',
                            u.plan === 'pro' && 'bg-primary/15 text-primary',
                            u.plan === 'free' && 'bg-muted text-muted-foreground'
                          )}>
                            {u.plan}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Users Management */}
        {activeTab === 'users' && (
          <div className="p-8 space-y-6">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadUsers(1)}
                  placeholder="Search user by name or email..."
                  className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-3 text-xs outline-none focus:border-primary transition"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="h-10 rounded-xl border border-border/70 bg-card px-3 text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free Tier</option>
                  <option value="pro">Pro ($12/mo)</option>
                  <option value="enterprise">Enterprise ($49/mo)</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 rounded-xl border border-border/70 bg-card px-3 text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>

                <button
                  onClick={() => loadUsers(1)}
                  className="h-10 px-4 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90 transition cursor-pointer"
                >
                  Filter
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/70 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">User</th>
                      <th className="px-4 py-3.5">Role</th>
                      <th className="px-4 py-3.5">Plan</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Mailboxes</th>
                      <th className="px-4 py-3.5">Storage Quota</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                          Loading accounts...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                          No users found matching your search criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-muted/20 transition">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                                {u.name ? u.name.substring(0, 2).toUpperCase() : 'US'}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{u.name}</p>
                                <p className="text-[11px] text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              'rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase',
                              u.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                            )}>
                              {u.role || 'user'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              'rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase',
                              u.plan === 'enterprise' && 'bg-emerald-500/15 text-emerald-500',
                              u.plan === 'pro' && 'bg-sky-500/15 text-sky-500',
                              (!u.plan || u.plan === 'free') && 'bg-muted text-muted-foreground'
                            )}>
                              {u.plan || 'free'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              u.status === 'suspended' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                            )}>
                              <span className={cn('size-1.5 rounded-full', u.status === 'suspended' ? 'bg-red-500' : 'bg-emerald-500')} />
                              {u.status || 'active'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            {u.email_accounts_count || 0} / {u.max_accounts || 1} accounts
                          </td>
                          <td className="px-4 py-4">
                            <div className="w-36 space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>{u.used_storage_mb || 0} MB</span>
                                <span>{u.max_storage_mb || 1000} MB</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full',
                                    (u.quota_percentage || 0) > 85 ? 'bg-red-500' : (u.quota_percentage || 0) > 60 ? 'bg-amber-500' : 'bg-primary'
                                  )}
                                  style={{ width: `${Math.min(100, u.quota_percentage || 0)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setImpersonatingUser(u)}
                                title="Impersonate (Log in as User)"
                                className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition cursor-pointer"
                              >
                                <ExternalLink className="size-3" /> Impersonate
                              </button>
                              <button
                                onClick={() => {
                                  setEditingUser(u)
                                  setEditFormData({
                                    name: u.name,
                                    role: u.role || 'user',
                                    plan: u.plan || 'free',
                                    status: u.status || 'active',
                                    max_storage_mb: u.max_storage_mb || 1000,
                                    max_accounts: u.max_accounts || 1,
                                    ai_credits_remaining: u.ai_credits_remaining !== undefined ? u.ai_credits_remaining : 50,
                                  })
                                }}
                                title="Edit Quota & Role"
                                className="rounded-lg border border-border/60 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                              >
                                <Edit2 className="size-3.5" />
                              </button>
                              {u.id !== currentUser?.id && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  title="Delete User"
                                  className="rounded-lg border border-border/60 p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {usersTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
                  <span>Showing page {usersPage} of {usersTotalPages} ({usersTotal} total users)</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => loadUsers(usersPage - 1)}
                      disabled={usersPage <= 1}
                      className="rounded-lg border border-border/60 p-1.5 hover:bg-muted disabled:opacity-40 transition cursor-pointer"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <button
                      onClick={() => loadUsers(usersPage + 1)}
                      disabled={usersPage >= usersTotalPages}
                      className="rounded-lg border border-border/60 p-1.5 hover:bg-muted disabled:opacity-40 transition cursor-pointer"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Storage & Quotas */}
        {activeTab === 'storage' && (
          <div className="p-8 space-y-6">
            <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl">
              <h3 className="text-sm font-bold">Storage Allocation & Quota Monitoring</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Monitor storage consumption across all mailboxes to prevent server disk overflow and manage SaaS limits.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <span className="text-xs font-semibold text-muted-foreground">Total Database Storage</span>
                  <p className="text-2xl font-bold mt-1 text-primary">{metrics?.total_storage_mb || 0} MB</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Across all user mailboxes</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <span className="text-xs font-semibold text-muted-foreground">Average per User</span>
                  <p className="text-2xl font-bold mt-1">
                    {metrics?.total_users ? (metrics.total_storage_mb / metrics.total_users).toFixed(2) : 0} MB
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Healthy consumption index</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <span className="text-xs font-semibold text-muted-foreground">Quota Policy</span>
                  <p className="text-sm font-bold mt-1 text-emerald-500">RFC 2087 IMAP & Local Guard</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Automatic sync warning at 90%</p>
                </div>
              </div>
            </div>

            {/* Storage Leaders List */}
            <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl overflow-hidden p-6 space-y-4">
              <h3 className="text-sm font-bold">Top Storage Consumers</h3>
              <div className="space-y-3">
                {users
                  .slice()
                  .sort((a, b) => (b.used_storage_mb || 0) - (a.used_storage_mb || 0))
                  .map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3 bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                          {u.name ? u.name.substring(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground">{u.email} &middot; {u.plan} tier</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">{u.used_storage_mb || 0} MB / {u.max_storage_mb || 1000} MB</p>
                        <p className="text-[10px] text-muted-foreground">{u.emails_count || 0} emails stored</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Diagnostics (IMAP / SMTP Connection Tester) */}
        {activeTab === 'diagnostics' && (
          <div className="p-8 max-w-3xl space-y-6">
            <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl space-y-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Server className="size-4 text-primary" /> Live Mail Server Socket Diagnostic Tool
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Directly test remote IMAP/SMTP handshake, SSL validation, socket latency, and credentials for any customer.
                </p>
              </div>

              <form onSubmit={handleTestConnection} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Protocol Type</label>
                    <div className="flex rounded-xl border border-border/70 p-1 bg-muted/30">
                      <button
                        type="button"
                        onClick={() => {
                          setDiagType('imap')
                          setDiagPort(993)
                          setDiagEncryption('ssl')
                        }}
                        className={cn(
                          'flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer',
                          diagType === 'imap' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        IMAP (Incoming)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiagType('smtp')
                          setDiagPort(465)
                          setDiagEncryption('ssl')
                        }}
                        className={cn(
                          'flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer',
                          diagType === 'smtp' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        SMTP (Outgoing)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Encryption Mode</label>
                    <select
                      value={diagEncryption}
                      onChange={(e) => setDiagEncryption(e.target.value)}
                      className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-xs outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="ssl">SSL / TLS (Direct)</option>
                      <option value="tls">STARTTLS</option>
                      <option value="none">Plaintext (Insecure)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Host Server FQDN</label>
                    <input
                      type="text"
                      required
                      value={diagHost}
                      onChange={(e) => setDiagHost(e.target.value)}
                      placeholder="e.g. mail.domain.com"
                      className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Port</label>
                    <input
                      type="number"
                      required
                      value={diagPort}
                      onChange={(e) => setDiagPort(Number(e.target.value))}
                      className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Username / Email</label>
                    <input
                      type="text"
                      required
                      value={diagUsername}
                      onChange={(e) => setDiagUsername(e.target.value)}
                      placeholder="user@domain.com"
                      className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-xs outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={diagPassword}
                      onChange={(e) => setDiagPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={testingConnection}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                >
                  {testingConnection ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Performing Socket Handshake...
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" /> Run Live Connection Diagnostic
                    </>
                  )}
                </button>
              </form>

              {/* Test Result Display */}
              {testResult && (
                <div className={cn(
                  'mt-4 rounded-xl border p-4 text-xs space-y-1.5 animate-in fade-in',
                  testResult.success
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-red-500/40 bg-red-500/10 text-red-400'
                )}>
                  <div className="flex items-center gap-2 font-bold">
                    {testResult.success ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                    <span>{testResult.success ? 'Diagnostic Test Passed!' : 'Connection Handshake Failed'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{testResult.message}</p>
                  {testResult.latency_ms !== undefined && (
                    <p className="text-[10px] font-semibold opacity-80">
                      Roundtrip Socket Latency: {testResult.latency_ms} ms
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold">Edit SaaS Account: {editingUser.name}</h3>
                <p className="text-[11px] text-muted-foreground">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="h-9 w-full rounded-xl border border-border bg-muted/30 px-3 outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Subscription Plan</label>
                  <select
                    value={editFormData.plan}
                    onChange={(e) => setEditFormData({ ...editFormData, plan: e.target.value })}
                    className="h-9 w-full rounded-xl border border-border bg-card px-2 outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="free">Free Tier</option>
                    <option value="pro">Pro ($12/mo)</option>
                    <option value="enterprise">Enterprise ($49/mo)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Account Role</label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    className="h-9 w-full rounded-xl border border-border bg-card px-2 outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="user">Normal User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Account Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="h-9 w-full rounded-xl border border-border bg-card px-2 outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Max Mailboxes</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editFormData.max_accounts}
                    onChange={(e) => setEditFormData({ ...editFormData, max_accounts: Number(e.target.value) })}
                    className="h-9 w-full rounded-xl border border-border bg-muted/30 px-3 outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Storage Quota (MB)</label>
                  <input
                    type="number"
                    min="100"
                    step="500"
                    value={editFormData.max_storage_mb}
                    onChange={(e) => setEditFormData({ ...editFormData, max_storage_mb: Number(e.target.value) })}
                    className="h-9 w-full rounded-xl border border-border bg-muted/30 px-3 outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">AI Credits Remaining</label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.ai_credits_remaining}
                    onChange={(e) => setEditFormData({ ...editFormData, ai_credits_remaining: Number(e.target.value) })}
                    className="h-9 w-full rounded-xl border border-border bg-muted/30 px-3 outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-muted transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                >
                  {savingUser ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Impersonation Confirmation Modal */}
      {impersonatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserCheck className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold">Impersonate Customer</h3>
              <p className="text-xs text-muted-foreground mt-1">
                You are about to log in as <strong>{impersonatingUser.name}</strong> ({impersonatingUser.email}).
                You will be redirected to their webmail inbox view.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImpersonatingUser(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImpersonate}
                disabled={impersonating}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
              >
                {impersonating ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
                Confirm & Launch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
