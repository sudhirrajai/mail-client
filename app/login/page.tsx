'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/toast'

export default function LoginPage() {
  const router = useRouter()
  const { showSuccess, showError } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    // If already logged in, redirect to home
    const token = api.getToken()
    if (token) {
      api.getMe().then((res) => {
        if (res) {
          router.replace('/')
        } else {
          setCheckingAuth(false)
        }
      }).catch(() => setCheckingAuth(false))
    } else {
      setCheckingAuth(false)
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await api.login(email, password)
      showSuccess('Welcome Back', `Logged in successfully as ${res.user.name}`)
      router.replace('/')
    } catch (err: any) {
      showError('Login Failed', err.message || 'Invalid credentials provided.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background p-4 text-foreground overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner">
            <Mail className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Mosaic Webmail</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">Sign in to access your mailboxes and messages</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="h-11 w-full rounded-2xl border border-border/70 bg-muted/30 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:bg-background"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-2xl border border-border/70 bg-muted/30 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:bg-background"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-50 mt-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <>Sign In <ArrowRight className="size-4" /></>}
          </button>
        </form>

        <div className="mt-8 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          <p>
            Don't have an account yet?{' '}
            <Link href="/register" className="font-semibold text-primary underline hover:opacity-90">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
