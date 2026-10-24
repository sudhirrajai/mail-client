'use client'

import { Command, Keyboard, X } from 'lucide-react'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutCategory {
  title: string
  shortcuts: ShortcutItem[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['J', '↓'], description: 'Next email thread' },
      { keys: ['K', '↑'], description: 'Previous email thread' },
      { keys: ['Enter', 'O'], description: 'Open selected thread' },
      { keys: ['Esc', 'U'], description: 'Return to message list' },
      { keys: ['/'], description: 'Search emails' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['C', 'N'], description: 'Compose new email' },
      { keys: ['R'], description: 'Reply to sender' },
      { keys: ['E'], description: 'Archive thread' },
      { keys: ['S'], description: 'Toggle star / unstar' },
      { keys: ['!'], description: 'Report as spam' },
      { keys: ['D', 'Del'], description: 'Move to trash' },
      { keys: ['M'], description: 'Mark as unread / read' },
      { keys: ['⌘', '↵'], description: 'Send email (in compose)' },
    ],
  },
  {
    title: 'Jump to Folder (press G then key)',
    shortcuts: [
      { keys: ['G', 'I'], description: 'Go to Inbox' },
      { keys: ['G', 'S'], description: 'Go to Starred' },
      { keys: ['G', 'T'], description: 'Go to Sent' },
      { keys: ['G', 'D'], description: 'Go to Drafts' },
      { keys: ['G', 'A'], description: 'Go to Archive' },
      { keys: ['G', 'P'], description: 'Go to Spam' },
      { keys: ['G', 'X'], description: 'Go to Trash' },
    ],
  },
]

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Keyboard className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Keyboard Shortcuts</h3>
              <p className="text-xs text-muted-foreground">Power-user shortcuts for desktop & laptop productivity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="overflow-y-auto py-4 space-y-6 flex-1 pr-1">
          {SHORTCUT_CATEGORIES.map((cat) => (
            <div key={cat.title} className="space-y-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {cat.title}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cat.shortcuts.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-xs"
                  >
                    <span className="text-foreground/90 font-medium truncate">{s.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="flex h-5 min-w-5 items-center justify-center rounded border border-border/80 bg-background px-1.5 font-mono text-[11px] font-semibold text-muted-foreground shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Command className="size-3.5 text-primary" /> Press <kbd className="rounded border border-border px-1 text-[10px] bg-muted font-mono font-bold">?</kbd> anytime to toggle this modal
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-muted px-3 py-1.5 font-medium text-foreground hover:bg-muted/80 transition cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
