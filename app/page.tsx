'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Mail,
  Zap,
  Shield,
  Smartphone,
  Keyboard,
  Check,
  ArrowRight,
  Layers,
  HardDrive,
  Sparkles,
  Server,
  Star,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  Play,
  Download,
  Lock,
} from 'lucide-react'
import { api, User } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function SaaSLandingPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    const token = api.getToken()
    if (token) {
      api.getMe().then((res) => {
        if (res && res.user) {
          setUser(res.user)
        }
      }).catch(() => {})
    }
  }, [])

  const faqs = [
    {
      q: 'Does Mosaic work with any custom domain or cPanel mail server?',
      a: 'Yes! Mosaic connects natively to any standard IMAP and SMTP server. Whether you are using cPanel, DirectAdmin, Postfix, Dovecot, Hostinger, Namecheap, Google Workspace, or AWS SES, you can sync in seconds.',
    },
    {
      q: 'Can I install Mosaic as an app on my iPhone, Android, Mac, or Windows PC?',
      a: 'Absolutely. Mosaic is a modern Progressive Web App (PWA). You can install it with one click from Chrome, Edge, or Safari, and get native OS notifications, app icon badges, and keyboard shortcuts.',
    },
    {
      q: 'Are my emails stored securely?',
      a: 'Yes. Your emails live directly on your own IMAP server. All communication between Mosaic and your mail server is encrypted via SSL/TLS. We never sell your data or train models on your private conversations.',
    },
    {
      q: 'Can I manage multiple email accounts in one inbox?',
      a: 'Yes! Mosaic includes a Unified Inbox that combines multiple company and personal domains into a single calm workspace, while letting you choose which address to send from with a single click.',
    },
    {
      q: 'What is the AI roadmap?',
      a: 'Coming in the next phase: AI Smart Drafts, 1-click thread summarization, tone adjustment (formal, friendly, concise), and automated message categorization.',
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary">
      {/* Dynamic Background Glow Elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute top-[600px] -left-40 size-[500px] rounded-full bg-sky-500/10 blur-[130px]" />
        <div className="absolute top-[1200px] -right-40 size-[500px] rounded-full bg-violet-500/10 blur-[130px]" />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <Mail className="size-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">Mosaic</span>
              <span className="text-xs font-semibold text-primary ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                SaaS
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#preview" className="hover:text-foreground transition">Interface</a>
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
          </nav>

          {/* Auth Action Buttons */}
          <div className="flex items-center gap-3">
            {mounted && user ? (
              <div className="flex items-center gap-2">
                {(user.is_admin || user.role === 'admin') && (
                  <Link
                    href="/admin"
                    className="hidden sm:flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                  >
                    <ShieldAlert className="size-3.5" /> Admin Panel
                  </Link>
                )}
                <Link
                  href="/mail"
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm shadow-primary/25 hover:opacity-90 transition"
                >
                  <span>Launch Webmail</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm shadow-primary/25 hover:opacity-90 transition"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-5xl px-6 pt-20 pb-16 text-center lg:pt-28">
        {/* Release Tag Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="size-3.5 text-amber-400" />
          <span>v2.0 Released: Real-Time IMAP Push & Installable PWA</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] max-w-4xl mx-auto">
          Your email, liberated. <br />
          <span className="bg-gradient-to-r from-primary via-sky-400 to-violet-400 bg-clip-text text-transparent">
            Calm, blazing fast, & unified.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          The modern webmail client built for professionals. Connect any custom domain or cPanel IMAP/SMTP server in seconds with zero lag, instant Superhuman-style shortcuts, and installable PWA speed.
        </p>

        {/* Dual Call To Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={mounted && user ? '/mail' : '/register'}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-95 transition cursor-pointer"
          >
            <span>{mounted && user ? 'Open Your Webmail' : 'Start Free Account'}</span>
            <ArrowRight className="size-4" />
          </Link>
          <a
            href="#features"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card/60 px-6 py-3.5 text-sm font-semibold text-foreground hover:bg-muted transition cursor-pointer"
          >
            <Play className="size-3.5 text-primary" /> Explore Platform Tour
          </a>
        </div>

        {/* Trust Badges */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Check className="size-4 text-emerald-500" /> 100% Private IMAP/SMTP
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="size-4 text-emerald-500" /> Desktop & Mobile PWA
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="size-4 text-emerald-500" /> RFC 2087 Quota Monitoring
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="size-4 text-emerald-500" /> Keyboard Shortcut Navigation
          </span>
        </div>
      </section>

      {/* Interactive App Mockup Preview */}
      <section id="preview" className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="relative rounded-3xl border border-border/80 bg-card/80 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 overflow-hidden">
          {/* Top Window Bar */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 bg-muted/30 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-red-500/80 inline-block" />
              <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="size-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-3 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Lock className="size-3 text-emerald-500" /> webmail.vmcore.in/mail
              </span>
            </div>
            <div className="text-[11px] font-semibold text-primary flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> IMAP Socket Live
            </div>
          </div>

          {/* Mini UI Representation */}
          <div className="grid grid-cols-12 min-h-[380px] bg-background/90 text-left">
            {/* Sidebar Preview */}
            <div className="col-span-3 border-r border-border/70 p-4 space-y-3 hidden sm:block bg-card/40">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 flex items-center gap-2">
                <div className="size-7 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center text-xs">
                  SR
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">Sudhir Rajai</p>
                  <p className="text-[10px] text-muted-foreground truncate">hello@sudhirrajai.com</p>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5 font-semibold text-primary">
                  <span className="flex items-center gap-2"><Mail className="size-3.5" /> Inbox</span>
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px]">3</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted">
                  <span className="flex items-center gap-2"><Star className="size-3.5" /> Starred</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted">
                  <span className="flex items-center gap-2"><Zap className="size-3.5" /> Sent</span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-muted">
                  <span className="flex items-center gap-2"><Shield className="size-3.5" /> Spam</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <div className="flex justify-between text-[10px] text-muted-foreground font-semibold mb-1">
                  <span>Storage: 6.6 MB</span>
                  <span>1000 MB</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[2%] bg-primary rounded-full" />
                </div>
              </div>
            </div>

            {/* Email List Preview */}
            <div className="col-span-12 sm:col-span-4 border-r border-border/70 p-3 space-y-2">
              <div className="h-8 rounded-lg bg-muted/40 border border-border/60 flex items-center px-2.5 text-xs text-muted-foreground">
                Search messages... (/)
              </div>
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-1 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground">Rajai Sudhir</span>
                  <span className="text-[10px] text-primary font-semibold">9:55 PM</span>
                </div>
                <p className="text-xs font-semibold text-foreground truncate">Re: Test mail</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">It works! Looking forward to reviewing the dashboard updates...</p>
                <div className="flex gap-1 pt-1">
                  <span className="rounded-md bg-sky-500/15 text-sky-400 px-1.5 py-0.5 text-[9px] font-bold uppercase">Work</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3 space-y-1 opacity-70">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">VMCore Support</span>
                  <span className="text-[10px] text-muted-foreground">7:10 PM</span>
                </div>
                <p className="text-xs font-medium text-foreground truncate">Nimbus Update Available: v1.0.9</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">New platform optimization patches are live...</p>
              </div>
            </div>

            {/* Email View Preview */}
            <div className="col-span-5 p-5 hidden sm:flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h3 className="font-bold text-sm">Re: Test mail</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">From: Rajai Sudhir &lt;rajaisudhir11@gmail.com&gt;</p>
                  </div>
                  <span className="rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5">
                    Verified SPF/DKIM
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Hi Sudhir,<br /><br />
                  Everything has been synced and verified with sub-second latency on the IMAP socket layer. The new admin controls look phenomenal!
                </p>
              </div>

              {/* Floating Quick Reply Bar */}
              <div className="rounded-xl border border-border/80 bg-muted/40 p-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground text-[11px]">Press R to reply...</span>
                <span className="rounded-md bg-primary px-3 py-1 font-bold text-primary-foreground text-[11px]">
                  Reply
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20 border-t border-border/70">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">SaaS Superpowers</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">Everything you need to master your communications.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl hover:border-primary/50 transition">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
              <Zap className="size-5" />
            </div>
            <h3 className="text-base font-bold">Sub-Second IMAP Sync</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Direct socket streaming fetches message headers in milliseconds. No stale webhooks or polling bottlenecks.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl hover:border-primary/50 transition">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 mb-4">
              <Smartphone className="size-5" />
            </div>
            <h3 className="text-base font-bold">Installable Desktop & Mobile PWA</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Install directly from Chrome or Safari. Receive incoming push notifications, audio chime alerts, and unread count badges.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl hover:border-primary/50 transition">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 mb-4">
              <Keyboard className="size-5" />
            </div>
            <h3 className="text-base font-bold">Superhuman-Style Shortcuts</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Navigate your inbox at the speed of thought. Press J/K to move, R to reply, E to archive, S to star, and / to search.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl hover:border-primary/50 transition">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 mb-4">
              <Layers className="size-5" />
            </div>
            <h3 className="text-base font-bold">Unified Multi-Account Inbox</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Add multiple custom domains or personal accounts. Switch between unified inbox and individual mailboxes in a click.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl hover:border-primary/50 transition">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 mb-4">
              <HardDrive className="size-5" />
            </div>
            <h3 className="text-base font-bold">RFC 2087 Quota Protection</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Reads your real server disk quota directly from Dovecot and Postfix so you never lose emails due to unexpected mailbox overflow.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-xl hover:border-primary/50 transition">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 mb-4">
              <Sparkles className="size-5" />
            </div>
            <h3 className="text-base font-bold">AI Power Architecture Ready</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Engineered with dedicated backend slots for AI smart replies, thread summarization, tone polishing, and automated tagging.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20 border-t border-border/70">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Simple Transparent Pricing</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">Pick the plan that fits your workflow.</p>

          {/* Billing Cycle Switcher */}
          <div className="mt-6 inline-flex items-center rounded-full border border-border/80 p-1 bg-card">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-semibold transition cursor-pointer',
                billingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer',
                billingCycle === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>Annual</span>
              <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 text-[9px] font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Free Starter */}
          <div className="rounded-3xl border border-border/70 bg-card/60 p-7 backdrop-blur-xl flex flex-col justify-between">
            <div className="space-y-4">
              <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground uppercase">
                Starter
              </span>
              <div>
                <span className="text-4xl font-extrabold">$0</span>
                <span className="text-xs text-muted-foreground ml-1">/ forever</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Perfect for personal use and evaluating the platform.
              </p>
              <div className="space-y-2.5 pt-4 border-t border-border/60 text-xs text-foreground">
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> 1 Connected Email Account</div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> 1,000 MB Storage Quota</div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> Desktop & Mobile PWA</div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> 50 AI Assistant Credits/mo</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Check className="size-4 text-muted-foreground/40" /> Standard IMAP Socket Sync</div>
              </div>
            </div>

            <Link
              href="/register?plan=free"
              className="mt-8 block w-full rounded-2xl border border-border/80 bg-muted/30 py-3 text-center text-xs font-bold text-foreground hover:bg-muted transition"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Plan (Highlighted) */}
          <div className="relative rounded-3xl border-2 border-primary bg-gradient-to-b from-primary/10 via-card/80 to-card p-7 shadow-xl shadow-primary/10 backdrop-blur-xl flex flex-col justify-between">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
              Most Popular
            </div>

            <div className="space-y-4">
              <span className="rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary uppercase">
                Pro Power User
              </span>
              <div>
                <span className="text-4xl font-extrabold">
                  {billingCycle === 'annual' ? '$9.60' : '$12'}
                </span>
                <span className="text-xs text-muted-foreground ml-1">/ user / mo</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                For freelancers, founders, and professionals managing multiple domains.
              </p>
              <div className="space-y-2.5 pt-4 border-t border-border/60 text-xs text-foreground">
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> <strong>5 Connected Mailboxes</strong></div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> <strong>10,000 MB Storage Quota</strong></div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> Priority High-Speed IMAP Streaming</div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> 500 AI Assistant Credits/mo</div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> Custom Tags & Smart Filters</div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> Priority Email & Chat Support</div>
              </div>
            </div>

            <Link
              href="/register?plan=pro"
              className="mt-8 block w-full rounded-2xl bg-primary py-3 text-center text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 transition"
            >
              Start 14-Day Free Pro Trial
            </Link>
          </div>

          {/* Enterprise Plan */}
          <div className="rounded-3xl border border-border/70 bg-card/60 p-7 backdrop-blur-xl flex flex-col justify-between">
            <div className="space-y-4">
              <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400 uppercase">
                Enterprise & Teams
              </span>
              <div>
                <span className="text-4xl font-extrabold">
                  {billingCycle === 'annual' ? '$39' : '$49'}
                </span>
                <span className="text-xs text-muted-foreground ml-1">/ mo</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Unlimited capabilities for growing businesses and agencies.
              </p>
              <div className="space-y-2.5 pt-4 border-t border-border/60 text-xs text-foreground">
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> <strong>Unlimited Connected Accounts</strong></div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> <strong>50,000 MB Storage Quota</strong></div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> Unlimited AI Summaries & Drafts</div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> Dedicated Admin Management Panel</div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> Live Protocol Diagnostics & Audit Logs</div>
                <div className="flex items-center gap-2"><Check className="size-4 text-emerald-500" /> 99.99% Uptime SLA</div>
              </div>
            </div>

            <Link
              href="/register?plan=enterprise"
              className="mt-8 block w-full rounded-2xl border border-border/80 bg-muted/30 py-3 text-center text-xs font-bold text-foreground hover:bg-muted transition"
            >
              Contact Enterprise Sales
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="mx-auto max-w-4xl px-6 py-20 border-t border-border/70">
        <div className="text-center mb-12">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Frequently Asked Questions</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">Everything you need to know.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={idx}
                className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-foreground hover:bg-muted/30 transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="size-4 text-primary shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground shrink-0 ml-4" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-muted-foreground leading-relaxed animate-in fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/15 via-sky-500/10 to-violet-500/15 p-10 text-center shadow-xl backdrop-blur-xl overflow-hidden">
          <h2 className="text-3xl font-extrabold tracking-tight">Ready to experience calm, lightning-fast email?</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
            Join professionals who have switched to Mosaic. Set up your private domain in less than 2 minutes.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href={mounted && user ? '/mail' : '/register'}
              className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90 transition"
            >
              <span>{mounted && user ? 'Go to Your Inbox' : 'Get Started for Free'}</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/70 bg-card/40 py-8 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-[10px]">
              M
            </div>
            <span>&copy; {new Date().getFullYear()} Mosaic SaaS Webmail. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-5 font-semibold">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">Support</a>
            <Link href="/login" className="hover:text-foreground">Client Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
