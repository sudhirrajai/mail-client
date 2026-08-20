'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastContextType {
  showToast: (title: string, type?: ToastType, message?: string) => void
  showSuccess: (title: string, message?: string) => void
  showError: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = (title: string, type: ToastType = 'info', message?: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, type, title, message }])
  }

  const showSuccess = (title: string, message?: string) => showToast(title, 'success', message)
  const showError = (title: string, message?: string) => showToast(title, 'error', message)

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 4500)
    return () => clearTimeout(timer)
  }, [onClose])

  const icons = {
    success: <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="size-5 text-red-400 shrink-0" />,
    info: <Info className="size-5 text-sky-400 shrink-0" />,
  }

  const styles = {
    success: 'border-emerald-500/30 bg-card/95 text-foreground shadow-emerald-500/10',
    error: 'border-red-500/30 bg-card/95 text-foreground shadow-red-500/10',
    info: 'border-sky-500/30 bg-card/95 text-foreground shadow-sky-500/10',
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5 duration-300',
        styles[toast.type]
      )}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-tight">{toast.title}</p>
        {toast.message && <p className="mt-1 text-[11px] text-muted-foreground leading-normal">{toast.message}</p>}
      </div>
      <button
        onClick={onClose}
        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
