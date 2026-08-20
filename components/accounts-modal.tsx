'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Server, CheckCircle2, AlertCircle, Trash2, RefreshCw, Loader2, Mail } from 'lucide-react'
import { api, EmailAccount } from '@/lib/api'
import { useToast } from '@/components/toast'

interface AccountsModalProps {
  isOpen: boolean
  onClose: () => void
  onAccountsChange?: () => void
}

export function AccountsModal({ isOpen, onClose, onAccountsChange }: AccountsModalProps) {
  const { showSuccess, showError } = useToast()

  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [syncingId, setSyncingId] = useState<number | null>(null)

  // Form State
  const [form, setForm] = useState({
    name: '',
    email_address: '',
    preset: 'gmail', // gmail, outlook, custom
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_encryption: 'ssl',
    imap_username: '',
    imap_password: '',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 465,
    smtp_encryption: 'ssl',
    smtp_username: '',
    smtp_password: '',
  })

  useEffect(() => {
    if (isOpen) {
      fetchAccounts()
    }
  }, [isOpen])

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const res = await api.getAccounts()
      setAccounts(res.accounts || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePresetChange = (preset: string) => {
    if (preset === 'gmail') {
      setForm((prev) => ({
        ...prev,
        preset,
        imap_host: 'imap.gmail.com',
        imap_port: 993,
        imap_encryption: 'ssl',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 465,
        smtp_encryption: 'ssl',
      }))
    } else if (preset === 'outlook') {
      setForm((prev) => ({
        ...prev,
        preset,
        imap_host: 'outlook.office365.com',
        imap_port: 993,
        imap_encryption: 'ssl',
        smtp_host: 'smtp.office365.com',
        smtp_port: 587,
        smtp_encryption: 'tls',
      }))
    } else {
      setForm((prev) => ({ ...prev, preset }))
    }
  }

  const handleEmailChange = (email: string) => {
    setForm((prev) => ({
      ...prev,
      email_address: email,
      imap_username: prev.imap_username || email,
      smtp_username: prev.smtp_username || email,
    }))
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testAccountConnection({
        imap_host: form.imap_host,
        imap_port: form.imap_port,
        imap_encryption: form.imap_encryption,
        imap_username: form.imap_username || form.email_address,
        imap_password: form.imap_password,
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_encryption: form.smtp_encryption,
        smtp_username: form.smtp_username || form.email_address,
        smtp_password: form.smtp_password,
      })
      setTestResult(result)
      if (result.success) {
        showSuccess('Connection Test Passed', result.message)
      } else {
        showError('Connection Test Failed', result.message)
      }
    } catch (err: any) {
      const errMsg = err.message || 'Connection test failed.'
      setTestResult({ success: false, message: errMsg })
      showError('Connection Test Failed', errMsg)
    } finally {
      setTesting(false)
    }
  }

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.createAccount({
        name: form.name || form.email_address,
        email_address: form.email_address,
        imap_host: form.imap_host,
        imap_port: form.imap_port,
        imap_encryption: form.imap_encryption,
        imap_username: form.imap_username || form.email_address,
        imap_password: form.imap_password,
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_encryption: form.smtp_encryption,
        smtp_username: form.smtp_username || form.email_address,
        smtp_password: form.smtp_password,
      })
      showSuccess('Account Added', `Mailbox ${form.email_address} connected successfully!`)
      setShowAddForm(false)
      fetchAccounts()
      if (onAccountsChange) onAccountsChange()
    } catch (err: any) {
      showError('Failed to Save Account', err.message || 'Please check your server parameters.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAccount = async (id: number) => {
    try {
      await api.deleteAccount(id)
      showSuccess('Account Removed', 'Email account configuration deleted.')
      fetchAccounts()
      if (onAccountsChange) onAccountsChange()
    } catch (err: any) {
      showError('Delete Failed', err.message || 'Could not delete email account.')
    }
  }

  const handleSyncAccount = async (id: number) => {
    setSyncingId(id)
    try {
      const res = await api.syncAccount(id)
      showSuccess('Sync Completed', res.message || 'Email inbox refreshed successfully.')
      if (onAccountsChange) onAccountsChange()
    } catch (err: any) {
      showError('Sync Failed', err.message || 'Failed to sync account via IMAP.')
    } finally {
      setSyncingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border/70 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Server className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Email Accounts & Credentials</h2>
              <p className="text-xs text-muted-foreground">Manage your connected SMTP & IMAP mailboxes</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {!showAddForm ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Configured Accounts ({accounts.length})</h3>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Plus className="size-4" /> Add Mail Account
                </button>
              </div>

              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <Mail className="mx-auto size-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-medium">No email accounts connected yet.</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Add your Gmail, Outlook, or hosting SMTP/IMAP credentials to sync and send emails.
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    <Plus className="size-4" /> Connect Email Account
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4"
                    >
                      <div>
                        <p className="text-sm font-semibold">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">{acc.email_address}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>IMAP: {acc.imap_host}:{acc.imap_port}</span>
                          <span>•</span>
                          <span>SMTP: {acc.smtp_host}:{acc.smtp_port}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSyncAccount(acc.id)}
                          disabled={syncingId === acc.id}
                          className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                          title="Sync Emails via IMAP"
                        >
                          <RefreshCw className={`size-3.5 ${syncingId === acc.id ? 'animate-spin' : ''}`} />
                          Sync
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <h3 className="text-sm font-semibold">Add New Email Account</h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Back to accounts list
                </button>
              </div>

              {/* Provider Presets */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Provider Preset</label>
                <div className="grid grid-cols-3 gap-2">
                  {['gmail', 'outlook', 'custom'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetChange(preset)}
                      className={`rounded-xl border p-2.5 text-xs font-semibold capitalize transition ${
                        form.preset === preset
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/70 hover:bg-muted'
                      }`}
                    >
                      {preset === 'gmail' ? 'Google / Gmail' : preset === 'outlook' ? 'Outlook / Office365' : 'Custom Server'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Account Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Work Mail"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border/70 bg-muted/40 px-3 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={form.email_address}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border/70 bg-muted/40 px-3 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* IMAP Configuration */}
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Incoming Mail (IMAP)
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[11px] text-muted-foreground">IMAP Host</label>
                    <input
                      type="text"
                      required
                      value={form.imap_host}
                      onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
                      className="h-8 w-full rounded-md border border-border/70 bg-background px-2 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">Port & Encryption</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        required
                        value={form.imap_port}
                        onChange={(e) => setForm({ ...form, imap_port: parseInt(e.target.value) || 993 })}
                        className="h-8 w-16 rounded-md border border-border/70 bg-background px-2 text-xs outline-none"
                      />
                      <select
                        value={form.imap_encryption}
                        onChange={(e) => setForm({ ...form, imap_encryption: e.target.value })}
                        className="h-8 flex-1 rounded-md border border-border/70 bg-background px-1 text-xs outline-none"
                      >
                        <option value="ssl">SSL</option>
                        <option value="tls">TLS</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">Username</label>
                    <input
                      type="text"
                      required
                      value={form.imap_username}
                      onChange={(e) => setForm({ ...form, imap_username: e.target.value })}
                      className="h-8 w-full rounded-md border border-border/70 bg-background px-2 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">Password / App Password</label>
                    <input
                      type="password"
                      required
                      value={form.imap_password}
                      onChange={(e) => setForm({ ...form, imap_password: e.target.value })}
                      className="h-8 w-full rounded-md border border-border/70 bg-background px-2 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SMTP Configuration */}
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Outgoing Mail (SMTP)
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[11px] text-muted-foreground">SMTP Host</label>
                    <input
                      type="text"
                      required
                      value={form.smtp_host}
                      onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                      className="h-8 w-full rounded-md border border-border/70 bg-background px-2 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">Port & Encryption</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        required
                        value={form.smtp_port}
                        onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) || 465 })}
                        className="h-8 w-16 rounded-md border border-border/70 bg-background px-2 text-xs outline-none"
                      />
                      <select
                        value={form.smtp_encryption}
                        onChange={(e) => setForm({ ...form, smtp_encryption: e.target.value })}
                        className="h-8 flex-1 rounded-md border border-border/70 bg-background px-1 text-xs outline-none"
                      >
                        <option value="ssl">SSL</option>
                        <option value="tls">TLS</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">Username</label>
                    <input
                      type="text"
                      required
                      value={form.smtp_username}
                      onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
                      className="h-8 w-full rounded-md border border-border/70 bg-background px-2 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">Password / App Password</label>
                    <input
                      type="password"
                      required
                      value={form.smtp_password}
                      onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                      className="h-8 w-full rounded-md border border-border/70 bg-background px-2 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              {testResult && (
                <div
                  className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
                    testResult.success
                      ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                      : 'border border-red-500/20 bg-red-500/10 text-red-500'
                  }`}
                >
                  {testResult.success ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTestConnection}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  {testing && <Loader2 className="size-3.5 animate-spin" />}
                  Test Connection
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="size-3.5 animate-spin" />}
                  Save Email Account
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
