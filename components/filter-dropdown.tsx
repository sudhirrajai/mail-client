'use client'

import { useState, useRef, useEffect } from 'react'
import { Filter, Check, ListFilter, Mail, Star, Paperclip, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FilterOption = 'All' | 'Unread' | 'Starred' | 'Has Attachments'

interface FilterDropdownProps {
  value: string
  onChange: (value: string) => void
}

const filterOptions: { label: FilterOption; icon: typeof ListFilter; description: string }[] = [
  { label: 'All', icon: ListFilter, description: 'Show all messages' },
  { label: 'Unread', icon: Mail, description: 'Only unread messages' },
  { label: 'Starred', icon: Star, description: 'Starred & flagged' },
  { label: 'Has Attachments', icon: Paperclip, description: 'Messages with files' },
]

export function FilterDropdown({ value, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = filterOptions.find((opt) => opt.label === value) || filterOptions[0]
  const SelectedIcon = selectedOption.icon

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-9 items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-3 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/50 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20',
          isOpen && 'border-primary bg-primary/10 text-primary'
        )}
      >
        <SelectedIcon className="size-3.5 text-primary" />
        <span className="truncate max-w-24">{value}</span>
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180 text-primary')} />
      </button>

      {/* Custom Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 z-30 mt-1.5 w-52 origin-top-right rounded-2xl border border-border/90 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md transition-all animate-in fade-in-50 zoom-in-95">
          <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Filter Messages
          </div>
          <div className="space-y-0.5">
            {filterOptions.map((opt) => {
              const Icon = opt.icon
              const isSelected = value === opt.label
              return (
                <button
                  key={opt.label}
                  onClick={() => {
                    onChange(opt.label)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition',
                    isSelected
                      ? 'bg-primary/15 font-semibold text-primary'
                      : 'text-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <div className={cn('flex size-6 items-center justify-center rounded-lg', isSelected ? 'bg-primary/20 text-primary' : 'text-muted-foreground')}>
                    <Icon className="size-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium leading-none">{opt.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{opt.description}</p>
                  </div>
                  {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
