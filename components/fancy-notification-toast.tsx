'use client'

import { useEffect, useState } from 'react'
import { Archive, ArrowRight, Mail, Sparkles, X } from 'lucide-react'
import { EmailItem } from '@/lib/api'
import { cn } from '@/lib/utils'

interface FancyNotificationToastProps {
  email: EmailItem | null
  onClose: () => void
  onView: (email: EmailItem) => void
  onArchive: (email: EmailItem) => void
}

export function FancyNotificationToast({
  email,
  onClose,
  onView,
  onArchive,
}: FancyNotificationToastProps) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!email) return

    setProgress(100)
    const duration = 6500 // 6.5s auto dismiss
    const intervalTime = 50
    const step = (intervalTime / duration) * 100

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          onClose()
          return 0
        }
        return prev - step
      })
    }, intervalTime)

    return () => clearInterval(timer)
  }, [email, onClose])

  if (!email) return null

  const senderInitials = (email.sender_name || email.sender_email || 'EM')
    .substring(0, 2)
    .toUpperCase()

  return (
    <div className="fixed top-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        {/* Subtle glowing accent blur behind */}
        <div className="absolute -right-8 -top-8 size-28 rounded-full bg-primary/20 blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5 animate-pulse" />
            <span>New Message Received</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Just now</span>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Sender and Snippet Content */}
        <div className="mt-3 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary/70 text-xs font-bold text-primary-foreground shadow-sm">
            {senderInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {email.sender_name || email.sender_email}
              </p>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {email.sender_email}
            </p>
            <p className="mt-1 truncate text-xs font-medium text-foreground">
              {email.subject || '(No Subject)'}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
              {email.preview || email.body_text || 'Click to view email content.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-3.5 flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <button
            onClick={() => {
              onArchive(email)
              onClose()
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border/80 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <Archive className="size-3" /> Archive
          </button>
          <button
            onClick={() => {
              onView(email)
              onClose()
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow hover:opacity-95 transition cursor-pointer"
          >
            View <ArrowRight className="size-3" />
          </button>
        </div>

        {/* Auto-Dismiss Progress Bar Line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
