'use client'

import { useState } from 'react'
import { X, User as UserIcon, Lock, KeyRound, Loader2, Check, ShieldCheck, Mail } from 'lucide-react'
import { api, User } from '@/lib/api'
import { useToast } from '@/components/toast'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  onUserUpdate: (updatedUser: User) => void
}

export function ProfileModal({ isOpen, onClose, user, onUserUpdate }: ProfileModalProps) {
  const { showSuccess, showError } = useToast()

  const [name, setName] = useState(user?.name || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  if (!isOpen || !user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      showError('Validation Error', 'Name cannot be empty.')
      return
    }

    if (changePasswordOpen) {
      if (!currentPassword) {
        showError('Validation Error', 'Please enter your current password.')
        return
      }
      if (newPassword.length < 6) {
        showError('Validation Error', 'New password must be at least 6 characters.')
        return
      }
      if (newPassword !== confirmPassword) {
        showError('Validation Error', 'New password confirmation does not match.')
        return
      }
    }

    setSaving(true)
    try {
      const payload: { name: string; current_password?: string; new_password?: string } = {
        name: name.trim(),
      }

      if (changePasswordOpen && newPassword) {
        payload.current_password = currentPassword
        payload.new_password = newPassword
      }

      const res = await api.updateProfile(payload)
      showSuccess('Profile Updated', res.message || 'Your profile has been saved.')
      onUserUpdate(res.user)

      // Reset password fields
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setChangePasswordOpen(false)
      onClose()
    } catch (err: any) {
      showError('Update Failed', err.message || 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  const initials = (name || user.name || 'US').substring(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">User Profile</h2>
              <p className="text-xs text-muted-foreground">Manage your personal account settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Avatar & Email Badge */}
          <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-muted/30 p-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-base shadow-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{name || user.name}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Mail className="size-3" />
                <span className="truncate">{user.email}</span>
                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium text-emerald-500">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Full Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary transition"
            />
          </div>

          {/* Email Address (Read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email Address
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="h-10 w-full rounded-xl border border-border/60 bg-muted/40 px-3.5 text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="text-[11px] text-muted-foreground">Login email address managed by your administrator.</p>
          </div>

          {/* Change Password Toggle */}
          <div className="border-t border-border/70 pt-4">
            {!changePasswordOpen ? (
              <button
                type="button"
                onClick={() => setChangePasswordOpen(true)}
                className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                <KeyRound className="size-3.5" /> Change Account Password
              </button>
            ) : (
              <div className="space-y-3.5 rounded-xl border border-border/80 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="size-3.5 text-primary" /> Change Password
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setChangePasswordOpen(false)
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="text-xs text-muted-foreground hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary transition"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/70">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="size-3.5" /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
