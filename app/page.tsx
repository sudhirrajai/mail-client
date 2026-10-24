'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileArchive,
  FileImage,
  FileText,
  Inbox,
  Mail,
  Menu,
  Paperclip,
  PenLine,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Star,
  Trash2,
  User as UserIcon,
  X,
  Loader2,
  Server,
  LogOut,
  Layers,
  MessageSquare,
  Keyboard,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, EmailItem, EmailAccount, User } from '@/lib/api'
import { emailCache } from '@/lib/email-cache'
import { mailEventBus } from '@/lib/mail-event-bus'
import { AccountsModal } from '@/components/accounts-modal'
import { FilterDropdown } from '@/components/filter-dropdown'
import { useToast } from '@/components/toast'
import { EmailListSkeleton, EmailReaderSkeleton } from '@/components/email-skeleton'
import { RichTextEditor } from '@/components/rich-text-editor'
import { ProfileModal } from '@/components/profile-modal'
import { ShortcutsModal } from '@/components/shortcuts-modal'
import { FancyNotificationToast } from '@/components/fancy-notification-toast'
import { notificationManager } from '@/lib/notification-manager'
import DOMPurify from 'dompurify'

type Folder = 'Inbox' | 'Starred' | 'Sent' | 'Drafts' | 'Archive' | 'Spam' | 'Trash'

const folderIcons: Record<Folder, typeof Inbox> = {
  Inbox,
  Starred: Star,
  Sent: Send,
  Drafts: PenLine,
  Archive,
  Spam: ShieldAlert,
  Trash: Trash2,
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(re|fwd|fw):\s*/i, '').trim().toLowerCase()
}

interface EmailThread {
  threadKey: string
  subject: string
  emails: EmailItem[]
  latestEmail: EmailItem
  unread: boolean
  starred: boolean
  count: number
}

function getCachedUser(): User | null {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('mosaic_cached_user')
    if (raw) {
      try {
        return JSON.parse(raw)
      } catch (e) {}
    }
  }
  return null
}

function getCachedAccounts(): EmailAccount[] {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('mosaic_cached_accounts')
    if (raw) {
      try {
        return JSON.parse(raw)
      } catch (e) {}
    }
  }
  return []
}

function IconButton({
  label,
  children,
  onClick,
  active,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground',
        active && 'bg-muted text-primary'
      )}
    >
      {children}
    </button>
  )
}

function AttachmentCard({ attachment }: { attachment: any }) {
  const Icon = attachment?.type === 'pdf' ? FileText : attachment?.type === 'image' ? FileImage : FileArchive

  const handleDownload = () => {
    if (attachment.url) {
      window.open(attachment.url, '_blank')
      return
    }
    if (attachment.content_base64) {
      const link = document.createElement('a')
      link.href = `data:${attachment.mime_type || 'application/octet-stream'};base64,${attachment.content_base64}`
      link.download = attachment.name || 'attachment'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return
    }
    const blob = new Blob([`Attachment file: ${attachment.name || 'document'}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = attachment.name || 'attachment.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
      <div className="flex size-10 items-center justify-center rounded-lg bg-background text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        <p className="text-xs text-muted-foreground">{attachment.size}</p>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="rounded-md px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition cursor-pointer"
      >
        Download
      </button>
    </div>
  )
}

export default function Page() {
  const router = useRouter()
  const { showSuccess, showError } = useToast()

  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(getCachedUser)
  const [accounts, setAccounts] = useState<EmailAccount[]>(getCachedAccounts)
  const [accountsLoaded, setAccountsLoaded] = useState<boolean>(() => getCachedAccounts().length > 0)
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(() => {
    const cached = getCachedAccounts()
    return cached.length > 0 ? cached[0].id : undefined
  })

  const [emails, setEmails] = useState<EmailItem[]>([])
  const [folder, setFolder] = useState<Folder>('Inbox')
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({})
  const [storageInfo, setStorageInfo] = useState<{ formatted: string; percentage: number }>({
    formatted: '',
    percentage: 0,
  })
  const [reply, setReply] = useState('')

  const [initLoading, setInitLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const isSyncingRef = useRef(false)
  const currentFolderRef = useRef<Folder>(folder)
  const currentAccountRef = useRef<number | undefined>(selectedAccountId)

  useEffect(() => {
    currentFolderRef.current = folder
  }, [folder])

  useEffect(() => {
    currentAccountRef.current = selectedAccountId
  }, [selectedAccountId])

  // Modals & Dropdown State
  const [accountsModalOpen, setAccountsModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false)
  const [incomingToastEmail, setIncomingToastEmail] = useState<EmailItem | null>(null)
  const knownEmailIdsRef = useRef<Set<number>>(new Set())
  const isInitialLoadRef = useRef(true)
  const [composeOpen, setComposeOpen] = useState(false)
  const [mailboxDropdownOpen, setMailboxDropdownOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const gPendingRef = useRef<NodeJS.Timeout | null>(null)

  // Compose State
  const composeFileInputRef = useRef<HTMLInputElement>(null)
  const [draftId, setDraftId] = useState<number | undefined>(undefined)
  const [savingDraft, setSavingDraft] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeCc, setComposeCc] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeAttachments, setComposeAttachments] = useState<import('@/components/rich-text-editor').AttachmentItem[]>([])
  const [sending, setSending] = useState(false)

  const handleComposeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        if (dataUrl) {
          const base64Data = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl
          const id = Math.random().toString(36).substring(7)
          const formatSize = (bytes: number) => {
            if (bytes < 1024) return `${bytes} B`
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
          }

          setComposeAttachments((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              size: formatSize(file.size),
              mime_type: file.type || 'application/octet-stream',
              content_base64: base64Data,
              isInlineImage: file.type.startsWith('image/'),
            },
          ])
        }
      }
      reader.readAsDataURL(file)
    }
  }

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      }
      const params = new URLSearchParams(window.location.search)
      const fParam = params.get('folder') as Folder
      if (fParam && ['Inbox', 'Starred', 'Sent', 'Drafts', 'Archive', 'Spam', 'Trash'].includes(fParam)) {
        setFolder(fParam)
        currentFolderRef.current = fParam
      } else {
        const saved = localStorage.getItem('mosaic_active_folder') as Folder
        if (saved && ['Inbox', 'Starred', 'Sent', 'Drafts', 'Archive', 'Spam', 'Trash'].includes(saved)) {
          setFolder(saved)
          currentFolderRef.current = saved
        }
      }
    }
    initApp()

    // Event Bus Observers
    const unsubStar = mailEventBus.on('EMAIL_STAR_TOGGLED', ({ emailId, starred }) => {
      setEmails((current) => {
        if (currentFolderRef.current === 'Starred' && !starred) {
          return current.filter((e) => e.id !== emailId)
        }
        return current.map((e) => (e.id === emailId ? { ...e, starred } : e))
      })
    })

    const unsubRead = mailEventBus.on('EMAIL_READ_TOGGLED', ({ emailId, unread }) => {
      setEmails((current) => current.map((e) => (e.id === emailId ? { ...e, unread } : e)))
    })

    const unsubDelete = mailEventBus.on('EMAIL_DELETED', ({ emailId, email }) => {
      setEmails((current) => {
        if (currentFolderRef.current === 'Trash') {
          if (email && email.folder !== 'Trash') {
            const trashItem: EmailItem = { ...email, folder: 'Trash' }
            return [trashItem, ...current.filter((e) => e.id !== emailId)]
          }
          return current.filter((e) => e.id !== emailId)
        }
        return current.filter((e) => e.id !== emailId)
      })
    })

    return () => {
      unsubStar()
      unsubRead()
      unsubDelete()
    }
  }, [])

  const initApp = async () => {
    try {
      const token = api.getToken()
      if (!token) {
        router.replace('/login')
        return
      }
      const meRes = await api.getMe()
      if (!meRes) {
        localStorage.removeItem('mosaic_cached_user')
        localStorage.removeItem('mosaic_cached_accounts')
        emailCache.clear()
        router.replace('/login')
        return
      }
      setUser(meRes.user)
      if (typeof window !== 'undefined') {
        localStorage.setItem('mosaic_cached_user', JSON.stringify(meRes.user))
      }
      await refreshAccounts()
    } catch (err) {
      console.error('Init error:', err)
      router.replace('/login')
    } finally {
      setInitLoading(false)
    }
  }

  const refreshAccounts = async () => {
    try {
      const res = await api.getAccounts()
      const fetchedAccounts = res.accounts || []
      setAccounts(fetchedAccounts)
      setAccountsLoaded(true)
      if (typeof window !== 'undefined') {
        localStorage.setItem('mosaic_cached_accounts', JSON.stringify(fetchedAccounts))
      }
      if (fetchedAccounts.length > 0) {
        const defaultId = fetchedAccounts[0].id
        setSelectedAccountId((prev) => (prev && fetchedAccounts.some((a) => a.id === prev) ? prev : defaultId))
      } else {
        setSelectedAccountId(undefined)
      }
    } catch (err) {
      console.error('Error fetching accounts:', err)
      setAccountsLoaded(true)
    }
  }

  const handleFolderChange = (newFolder: Folder) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
    if (newFolder === folder) return
    setFolder(newFolder)
    currentFolderRef.current = newFolder
    if (typeof window !== 'undefined') {
      localStorage.setItem('mosaic_active_folder', newFolder)
      const url = new URL(window.location.href)
      url.searchParams.set('folder', newFolder)
      window.history.replaceState({}, '', url.toString())
    }

    const accId = selectedAccountId || (accounts.length > 0 ? accounts[0].id : undefined)
    
    if (emailCache.has(accId, newFolder, query, filter)) {
      setEmails(emailCache.get(accId, newFolder, query, filter) || [])
      setSyncing(false)
    } else {
      setEmails([])
      setSyncing(true)
    }
    setSelectedThreadKey(null)
  }

  const handleAccountChange = (accId: number | undefined) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
    if (accId === selectedAccountId) return
    setSelectedAccountId(accId)
    currentAccountRef.current = accId
    
    if (emailCache.has(accId, folder, query, filter)) {
      setEmails(emailCache.get(accId, folder, query, filter) || [])
      setSyncing(false)
    } else {
      setEmails([])
      setSyncing(true)
    }
    setSelectedThreadKey(null)
  }

  const handleSync = async (notify = false, isBackground = false, targetFolder?: Folder, targetAccId?: number, targetQuery?: string, targetTag?: string | null) => {
    if (!api.getToken()) return

    const activeFolder = targetFolder || currentFolderRef.current
    const activeAccId = targetAccId !== undefined ? targetAccId : currentAccountRef.current
    const activeQuery = targetQuery !== undefined ? targetQuery : query
    const activeTag = targetTag !== undefined ? targetTag : selectedTag

    if (isSyncingRef.current && !notify && !isBackground) return

    const alreadyVisited = emailCache.has(activeAccId, activeFolder, activeQuery, filter)

    if (alreadyVisited && !notify) {
      const cached = emailCache.get(activeAccId, activeFolder, activeQuery, filter)
      if (cached) {
        setEmails(cached)
      }
      setSyncing(false)

      if (emailCache.isValid(activeAccId, activeFolder, activeQuery, filter) && !isBackground) {
        return
      }
    } else if (!alreadyVisited && !isBackground) {
      setSyncing(true)
    }

    isSyncingRef.current = true
    try {
      if (activeAccId) {
        try {
          const syncRes = await api.syncAccount(activeAccId)
          if (notify && syncRes.fetched_count && syncRes.fetched_count > 0) {
            showSuccess('Inbox Synced', `${syncRes.fetched_count} new messages fetched.`)
          }
        } catch (e) {
          if (notify) throw e
        }
      }

      const res = await api.getEmails(activeAccId, activeFolder, activeQuery, filter, activeTag || undefined)
      const fetchedEmails = res.emails || []

      if (res.folder_counts) {
        setFolderCounts(res.folder_counts)
      }
      if (res.storage) {
        setStorageInfo(res.storage)
      }

      // Check for newly arrived emails to trigger audio chime and notifications
      if (isInitialLoadRef.current) {
        fetchedEmails.forEach((e) => knownEmailIdsRef.current.add(e.id))
        if (fetchedEmails.length > 0) {
          isInitialLoadRef.current = false
        }
      } else {
        const newlyReceived = fetchedEmails.filter(
          (e) => !knownEmailIdsRef.current.has(e.id) && e.folder === 'Inbox' && e.unread
        )
        fetchedEmails.forEach((e) => knownEmailIdsRef.current.add(e.id))

        if (newlyReceived.length > 0) {
          const latestNew = newlyReceived[0]
          // 1. Play crystal-clear glass audio chime
          notificationManager.playChime()

          // 2. Display fancy in-app toast
          setIncomingToastEmail(latestNew)

          // 3. Trigger Native OS Notification (PWA / desktop / mobile)
          notificationManager.showOsNotification(
            `New message from ${latestNew.sender_name || latestNew.sender_email}`,
            `${latestNew.subject || '(No Subject)'}\n${latestNew.preview || ''}`,
            latestNew.id,
            () => {
              const matchingThread = threadsRef.current.find((t) => t.emails.some((em) => em.id === latestNew.id))
              if (matchingThread) selectThread(matchingThread)
            }
          )
        }
      }

      emailCache.set(activeAccId, activeFolder, activeQuery, filter, fetchedEmails)

      if (currentFolderRef.current === activeFolder) {
        setEmails(fetchedEmails)
      }
    } catch (err: any) {
      console.error('Error syncing emails:', err)
      if (notify) {
        showError('Sync Error', err.message || 'Failed to sync emails.')
      }
    } finally {
      setSyncing(false)
      isSyncingRef.current = false
    }
  }

  // Live search and tag filter debounced sync to query backend
  useEffect(() => {
    if (!mounted || !user) return
    const timer = setTimeout(() => {
      handleSync(false, true, currentFolderRef.current, currentAccountRef.current, query, selectedTag)
    }, 350)
    return () => clearTimeout(timer)
  }, [query, selectedTag])

  // Fast background auto-polling every 12 seconds + instant on tab focus/visibility
  useEffect(() => {
    if (!user || !mounted) return

    handleSync(false, false, folder, selectedAccountId)

    const interval = setInterval(() => {
      handleSync(false, true, currentFolderRef.current, currentAccountRef.current)
    }, 12000)

    // Instant sync when user switches back to the tab or focuses the app
    const handleFocusSync = () => {
      if (document.visibilityState === 'visible') {
        handleSync(false, true, currentFolderRef.current, currentAccountRef.current)
      }
    }

    window.addEventListener('focus', handleFocusSync)
    document.addEventListener('visibilitychange', handleFocusSync)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocusSync)
      document.removeEventListener('visibilitychange', handleFocusSync)
    }
  }, [folder, filter, selectedAccountId, user, mounted])

  // Request browser Notification permission on mount
  useEffect(() => {
    if (mounted && user) {
      notificationManager.requestPermission().catch(() => {})
    }
  }, [mounted, user])

  const visibleEmails = useMemo(() => {
    return emails.filter((email) => {
      const matchesQuery = !query || `${email.sender_name} ${email.sender_email} ${email.subject} ${email.preview}`
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesTag = !selectedTag || (email.tags && email.tags.includes(selectedTag))
      return matchesQuery && matchesTag
    })
  }, [emails, query, selectedTag])

  // Email Threading Conversation Grouping Logic
  const threads = useMemo<EmailThread[]>(() => {
    const map = new Map<string, EmailItem[]>()

    visibleEmails.forEach((email) => {
      const norm = normalizeSubject(email.subject)
      const key = norm || 'no_subject'
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(email)
    })

    const result: EmailThread[] = []

    map.forEach((items, key) => {
      // Sort items by date_sent ascending (chronological conversation flow)
      items.sort((a, b) => new Date(a.date_sent).getTime() - new Date(b.date_sent).getTime())

      const latestEmail = items[items.length - 1]
      const displaySubject = latestEmail.subject.replace(/^(re|fwd|fw):\s*/i, '').trim() || latestEmail.subject

      result.push({
        threadKey: key,
        subject: displaySubject,
        emails: items,
        latestEmail,
        unread: items.some((e) => e.unread),
        starred: items.some((e) => e.starred),
        count: items.length,
      })
    })

    // Sort threads by latest email date descending (newest thread on top)
    result.sort((a, b) => new Date(b.latestEmail.date_sent).getTime() - new Date(a.latestEmail.date_sent).getTime())

    return result
  }, [visibleEmails])

  const selectedThread = useMemo(
    () => threads.find((t) => t.threadKey === selectedThreadKey) ?? null,
    [threads, selectedThreadKey]
  )

  const unreadCount = useMemo(
    () => emails.filter((email) => email.folder === 'Inbox' && email.unread).length,
    [emails]
  )

  // Sync App Badge, Dynamic Favicon Dot, and Tab Title with unreadCount
  useEffect(() => {
    notificationManager.updateAppBadge(unreadCount)
    notificationManager.updateFaviconDot(unreadCount > 0)
    notificationManager.updateTabTitle(unreadCount, folder)
  }, [unreadCount, folder])

  const selectThread = async (thread: EmailThread) => {
    if (thread.latestEmail.folder === 'Drafts') {
      const d = thread.latestEmail
      setDraftId(d.id)
      setComposeTo(d.recipient_to || '')
      setComposeCc(d.recipient_cc || '')
      setComposeSubject(d.subject === '(Draft No Subject)' ? '' : d.subject)
      setComposeBody(d.body_html || d.body_text || '')
      setComposeOpen(true)
      return
    }

    setSelectedThreadKey(thread.threadKey)
    // Mark unread emails in thread as read and ensure full content is loaded
    thread.emails.forEach(async (email) => {
      const needsFullLoad = !email.body_html || email.unread
      if (email.unread) {
        mailEventBus.emit('EMAIL_READ_TOGGLED', { emailId: email.id, unread: false })
      }
      if (needsFullLoad) {
        try {
          const res = await api.getEmail(email.id)
          if (res?.email) {
            setEmails((current) => current.map((e) => (e.id === email.id ? { ...e, ...res.email } : e)))
          }
        } catch (e) {}
      }
    })
  }

  // Refs for keyboard shortcuts to always access up-to-date data without rebinding
  const threadsRef = useRef(threads)
  threadsRef.current = threads
  const selectedThreadRef = useRef(selectedThread)
  selectedThreadRef.current = selectedThread
  const selectedThreadKeyRef = useRef(selectedThreadKey)
  selectedThreadKeyRef.current = selectedThreadKey

  // Power-User Keyboard Shortcuts Listener (Desktop, Laptop & PWA)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Check Cmd+Enter or Ctrl+Enter to send email in compose modal
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (composeOpen) {
          e.preventDefault()
          const form = document.getElementById('compose-email-form') as HTMLFormElement
          if (form) {
            form.requestSubmit()
            return
          }
        }
      }

      // 2. Escape: closes open modals or deselects active thread
      if (e.key === 'Escape') {
        if (shortcutsModalOpen) setShortcutsModalOpen(false)
        else if (profileModalOpen) setProfileModalOpen(false)
        else if (composeOpen) setComposeOpen(false)
        else if (accountsModalOpen) setAccountsModalOpen(false)
        else if (mailboxDropdownOpen) setMailboxDropdownOpen(false)
        else if (selectedThreadKeyRef.current) setSelectedThreadKey(null)
        return
      }

      const activeEl = document.activeElement
      const isTyping =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)

      if (isTyping) return

      const key = e.key.toLowerCase()

      // 3. Question mark (?): open keyboard shortcuts cheat sheet
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsModalOpen((prev) => !prev)
        return
      }

      // 4. Slash (/): focus search bar
      if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      // 5. 'g' then key: Jump to Folder
      if (gPendingRef.current) {
        clearTimeout(gPendingRef.current)
        gPendingRef.current = null
        if (key === 'i') { e.preventDefault(); setFolder('Inbox'); setSelectedThreadKey(null); return }
        if (key === 's') { e.preventDefault(); setFolder('Starred'); setSelectedThreadKey(null); return }
        if (key === 't') { e.preventDefault(); setFolder('Sent'); setSelectedThreadKey(null); return }
        if (key === 'd') { e.preventDefault(); setFolder('Drafts'); setSelectedThreadKey(null); return }
        if (key === 'a') { e.preventDefault(); setFolder('Archive'); setSelectedThreadKey(null); return }
        if (key === 'p') { e.preventDefault(); setFolder('Spam'); setSelectedThreadKey(null); return }
        if (key === 'x') { e.preventDefault(); setFolder('Trash'); setSelectedThreadKey(null); return }
      }

      if (key === 'g') {
        e.preventDefault()
        gPendingRef.current = setTimeout(() => {
          gPendingRef.current = null
        }, 1200)
        return
      }

      // 6. Navigation: j or Down Arrow (Next thread)
      if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        const currentThreads = threadsRef.current
        if (currentThreads.length === 0) return
        if (!selectedThreadKeyRef.current) {
          selectThread(currentThreads[0])
        } else {
          const currentIndex = currentThreads.findIndex((t) => t.threadKey === selectedThreadKeyRef.current)
          if (currentIndex >= 0 && currentIndex < currentThreads.length - 1) {
            selectThread(currentThreads[currentIndex + 1])
          }
        }
        return
      }

      // 7. Navigation: k or Up Arrow (Previous thread)
      if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        const currentThreads = threadsRef.current
        if (currentThreads.length === 0) return
        if (!selectedThreadKeyRef.current) {
          selectThread(currentThreads[0])
        } else {
          const currentIndex = currentThreads.findIndex((t) => t.threadKey === selectedThreadKeyRef.current)
          if (currentIndex > 0) {
            selectThread(currentThreads[currentIndex - 1])
          }
        }
        return
      }

      // 8. Open: Enter or 'o'
      if (e.key === 'Enter' || key === 'o') {
        const currentThreads = threadsRef.current
        if (!selectedThreadKeyRef.current && currentThreads.length > 0) {
          e.preventDefault()
          selectThread(currentThreads[0])
          return
        }
      }

      // 9. Back: 'u'
      if (key === 'u') {
        if (selectedThreadKeyRef.current) {
          e.preventDefault()
          setSelectedThreadKey(null)
          return
        }
      }

      // 10. Compose: 'c' or 'n'
      if (key === 'c' || key === 'n') {
        e.preventDefault()
        if (accounts.length > 0) {
          setComposeOpen(true)
        } else {
          showError('No Connected Mailbox', 'Please connect an SMTP email account in settings first.')
          setAccountsModalOpen(true)
        }
        return
      }

      // 11. Actions on active/selected thread
      const currentThread = selectedThreadRef.current
      if (currentThread) {
        const latest = currentThread.latestEmail

        if (key === 'r') {
          // Reply
          e.preventDefault()
          setComposeTo(latest.sender_email)
          setComposeSubject(`Re: ${currentThread.subject}`)
          setComposeOpen(true)
        } else if (key === 'e' || key === 'y') {
          // Archive
          e.preventDefault()
          currentThread.emails.forEach((em) => handleArchiveEmail(em.id))
          const currentThreads = threadsRef.current
          const currentIndex = currentThreads.findIndex((t) => t.threadKey === selectedThreadKeyRef.current)
          if (currentIndex >= 0 && currentIndex < currentThreads.length - 1) {
            selectThread(currentThreads[currentIndex + 1])
          } else if (currentIndex > 0) {
            selectThread(currentThreads[currentIndex - 1])
          } else {
            setSelectedThreadKey(null)
          }
        } else if (key === 's') {
          // Star
          e.preventDefault()
          toggleStar(latest.id)
        } else if (key === '!' || (e.shiftKey && e.key === '1')) {
          // Report Spam
          e.preventDefault()
          currentThread.emails.forEach((em) => handleSpamEmail(em.id))
          setSelectedThreadKey(null)
        } else if (key === 'd' || e.key === 'Delete' || key === '#') {
          // Delete
          e.preventDefault()
          currentThread.emails.forEach((em) => handleDeleteEmail(em.id))
          setSelectedThreadKey(null)
        } else if (key === 'm') {
          // Toggle Unread
          e.preventDefault()
          const newUnread = !currentThread.unread
          currentThread.emails.forEach((em) => handleToggleUnread(em.id, newUnread))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [composeOpen, accountsModalOpen, profileModalOpen, shortcutsModalOpen, mailboxDropdownOpen, accounts])

  const handleToggleUnread = async (id: number, unread: boolean) => {
    setEmails((current) => current.map((e) => (e.id === id ? { ...e, unread } : e)))
    mailEventBus.emit('EMAIL_READ_TOGGLED', { emailId: id, unread })
    try {
      await api.markRead(id, unread)
    } catch (e) {
      console.error(e)
    }
  }

  const toggleStar = async (id: number) => {
    const targetEmail = emails.find((e) => e.id === id)
    const newStarred = targetEmail ? !targetEmail.starred : true

    mailEventBus.emit('EMAIL_STAR_TOGGLED', { emailId: id, starred: newStarred })

    try {
      await api.toggleStar(id)
    } catch (err) {
      console.error(err)
    }
  }

  const handleMoveToInbox = async (id: number) => {
    setEmails((current) => current.filter((email) => email.id !== id))
    emailCache.clear()

    try {
      await api.moveToFolder(id, 'Inbox')
      showSuccess('Moved to Inbox', 'Message restored to Inbox.')
    } catch (err: any) {
      showError('Move Failed', err.message || 'Could not move message to Inbox.')
    }
  }

  const handleArchiveEmail = async (id: number) => {
    setEmails((current) => current.filter((email) => email.id !== id))
    emailCache.clear()

    try {
      await api.moveToFolder(id, 'Archive')
      showSuccess('Email Archived', 'Message moved to Archive.')
    } catch (err: any) {
      showError('Archive Failed', err.message || 'Could not archive message.')
    }
  }

  const handleSpamEmail = async (id: number) => {
    setEmails((current) => current.filter((email) => email.id !== id))
    emailCache.clear()

    try {
      await api.moveToFolder(id, 'Spam')
      showSuccess('Reported as Spam', 'Message moved to Spam folder.')
    } catch (err: any) {
      showError('Action Failed', err.message || 'Could not move message to Spam.')
    }
  }

  const handleDeleteEmail = async (id: number) => {
    const targetEmail = emails.find((e) => e.id === id)
    mailEventBus.emit('EMAIL_DELETED', { emailId: id, email: targetEmail })

    try {
      await api.deleteEmail(id)
      if (currentFolderRef.current === 'Trash') {
        showSuccess('Permanently Deleted', 'Message deleted permanently.')
      } else {
        showSuccess('Email Deleted', 'Message moved to trash.')
      }
    } catch (err: any) {
      showError('Delete Failed', err.message || 'Could not delete message.')
    }
  }

  const handleSaveDraft = async () => {
    const accountId = selectedAccountId || (accounts.length > 0 ? accounts[0].id : undefined)
    if (!accountId) {
      showError('No Connected Mailbox', 'Please connect an email account first in Settings.')
      return
    }

    setSavingDraft(true)
    try {
      const res = await api.saveDraft({
        id: draftId,
        account_id: accountId,
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      })
      showSuccess('Draft Saved', res.message || 'Your draft has been saved.')
      setDraftId(res.email.id)
      setEmails((current) => [res.email, ...current.filter((e) => e.id !== res.email.id)])
      emailCache.clear()
    } catch (err: any) {
      showError('Save Failed', err.message || 'Could not save draft.')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accounts || accounts.length === 0) {
      showError('No Connected Mailbox', 'Please connect an email account first in Settings.')
      setAccountsModalOpen(true)
      return
    }

    const accountId = selectedAccountId || (accounts.length > 0 ? accounts[0].id : undefined)
    setSending(true)
    try {
      const res = await api.sendEmail({
        account_id: accountId!,
        to: composeTo,
        cc: composeCc,
        subject: composeSubject,
        body: composeBody,
        attachments: composeAttachments,
      })
      showSuccess('Email Sent', res.message || 'Your email has been sent successfully!')
      setComposeOpen(false)
      setComposeTo('')
      setComposeCc('')
      setComposeSubject('')
      setComposeBody('')
      setComposeAttachments([])

      if (res.email) {
        setEmails((current) => [res.email!, ...current.filter((e) => e.id !== res.email!.id)])
        emailCache.clear()
        mailEventBus.emit('EMAIL_SENT', { email: res.email })
      }
      handleSync(false, true, folder, accountId)
    } catch (err: any) {
      showError('Failed to Send Email', err.message || 'Error occurred while connecting to SMTP server.')
    } finally {
      setSending(false)
    }
  }

  const handleLogout = async () => {
    await api.logout()
    setUser(null)
    setEmails([])
    setAccounts([])
    setSelectedAccountId(undefined)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mosaic_cached_user')
      localStorage.removeItem('mosaic_cached_accounts')
      localStorage.removeItem('mosaic_active_folder')
      emailCache.clear()
    }
    showSuccess('Signed Out', 'You have been logged out.')
    router.replace('/login')
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Sidebar - Responsive Drawer on Mobile, Inline on Desktop */}
      {sidebarOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col justify-between overflow-hidden border-r border-border/80 bg-card p-3 shadow-2xl animate-in slide-in-from-left duration-200 md:static md:z-auto md:h-full md:w-60 md:border-border/70 md:bg-card/50 md:shadow-none md:animate-none">
            {/* Top Fixed Block */}
            <div className="shrink-0 space-y-2.5 pb-1">
              {/* Mobile Header with Close Button */}
              <div className="flex items-center justify-between pb-2 border-b border-border/60 md:hidden">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Navigation</span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
              {mounted && user ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 p-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setSidebarOpen(false)
                  }
                  setProfileModalOpen(true)
                }}
                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-85 transition cursor-pointer group"
                title="View & Edit Profile"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs uppercase group-hover:ring-2 ring-primary/40 transition">
                  {user.name ? user.name.substring(0, 2) : 'US'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold group-hover:text-primary transition">{user.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                </div>
              </button>
              <button
                onClick={handleLogout}
                title="Log Out"
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-red-500 transition cursor-pointer"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-2 animate-pulse">
              <div className="size-8 rounded-lg bg-muted/60" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-20 rounded bg-muted/80" />
                <div className="h-2.5 w-28 rounded bg-muted/50" />
              </div>
            </div>
          )}

            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setSidebarOpen(false)
                }
                if (accounts.length === 0) {
                  showError('No Connected Mailbox', 'Please connect an SMTP email account in settings first.')
                  setAccountsModalOpen(true)
                  return
                }
                setComposeOpen(true)
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer"
            >
              <Plus className="size-4" /> Compose email
            </button>

            {/* Mailboxes / Accounts Dropdown Selector */}
            <div className="relative">
              <div className="flex items-center justify-between px-3 pb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mailboxes ({mounted ? accounts.length : 0})
                </p>
                <button
                  onClick={() => setAccountsModalOpen(true)}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" /> Add
                </button>
              </div>

              {!mounted ? (
                <div className="space-y-1 px-1">
                  <div className="h-9 w-full animate-pulse rounded-xl bg-muted/40" />
                </div>
              ) : accounts.length === 0 ? (
                <button
                  onClick={() => setAccountsModalOpen(true)}
                  className="w-full text-left rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-primary hover:bg-primary/10 transition cursor-pointer"
                >
                  <p className="font-semibold flex items-center gap-1.5"><Server className="size-3.5" /> Connect Account</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Add SMTP & IMAP credentials to sync emails.</p>
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setMailboxDropdownOpen(!mailboxDropdownOpen)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedAccountId === undefined ? (
                        <Layers className="size-3.5 shrink-0 text-primary" />
                      ) : (
                        <Server className="size-3.5 shrink-0 text-primary" />
                      )}
                      <span className="truncate">
                        {selectedAccountId === undefined
                          ? 'Unified Inbox'
                          : accounts.find((a) => a.id === selectedAccountId)?.name || 'Select Mailbox'}
                      </span>
                    </div>
                    <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', mailboxDropdownOpen && 'rotate-180')} />
                  </button>

                  {mailboxDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl backdrop-blur-lg animate-in fade-in-50 zoom-in-95">
                      <button
                        onClick={() => {
                          handleAccountChange(undefined)
                          setMailboxDropdownOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition hover:bg-muted cursor-pointer',
                          selectedAccountId === undefined && 'bg-primary/15 font-semibold text-primary'
                        )}
                      >
                        <Layers className="size-3.5 text-primary shrink-0" />
                        <div className="text-left min-w-0 flex-1">
                          <p className="truncate font-medium">Unified Inbox</p>
                          <p className="truncate text-[10px] text-muted-foreground">All accounts combined</p>
                        </div>
                      </button>

                      <div className="my-1 border-t border-border/60" />

                      {accounts.map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() => {
                            handleAccountChange(acc.id)
                            setMailboxDropdownOpen(false)
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition hover:bg-muted cursor-pointer',
                            selectedAccountId === acc.id && 'bg-primary/15 font-semibold text-primary'
                          )}
                        >
                          <Server className="size-3.5 text-primary shrink-0" />
                          <div className="text-left min-w-0 flex-1">
                            <p className="truncate font-medium">{acc.name}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{acc.email_address}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* End Top Fixed Block */}

          {/* Middle Scrollable Section (Folders & Labels) */}
          <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll pr-1 py-1 space-y-3">
            {/* Folder Navigation */}
            <div className="flex flex-col gap-0.5">
              {Object.entries(folderIcons).map(([name, Icon]) => {
                const key = name as Folder
                const count = folderCounts[key] !== undefined ? folderCounts[key] : (key === 'Inbox' ? unreadCount : 0)
                return (
                  <button
                    key={name}
                    onClick={() => handleFolderChange(key)}
                    className={cn(
                      'flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer',
                      folder === key && 'bg-primary/10 font-medium text-primary'
                    )}
                  >
                    <div className="relative flex items-center">
                      <Icon className="size-4" />
                      {key === 'Inbox' && count > 0 && (
                        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                      )}
                    </div>
                    <span className="flex-1 text-left">{name}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Labels */}
            <div className="pt-1">
              <div className="flex items-center justify-between px-3 pb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Labels
                </p>
                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {[
                  ['Work', 'bg-sky-500'],
                  ['Personal', 'bg-emerald-500'],
                  ['Finance', 'bg-violet-500'],
                  ['Urgent', 'bg-red-500'],
                ].map(([label, dot]) => {
                  const tagCount = emails.filter((e) => e.tags && e.tags.includes(label)).length
                  const isActive = selectedTag === label
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        setSelectedTag(isActive ? null : label)
                        if (typeof window !== 'undefined' && window.innerWidth < 768) {
                          setSidebarOpen(false)
                        }
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer',
                        isActive && 'bg-primary/10 font-medium text-primary'
                      )}
                    >
                      <span className={cn('size-2 rounded-full', dot)} />
                      <span className="flex-1 text-left">{label}</span>
                      {tagCount > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {tagCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          {/* End Middle Scrollable Section */}

          {/* Bottom Fixed Footer - Guaranteed 100% visible on any screen without zooming out */}
          <div className="shrink-0 border-t border-border/70 pt-2.5 space-y-2 mt-auto">
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Storage</span>
                <span className="font-medium text-foreground">{storageInfo.formatted || 'Calculating...'}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${storageInfo.percentage}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setSidebarOpen(false)
                  }
                  setAccountsModalOpen(true)
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition cursor-pointer"
              >
                <Server className="size-3.5" /> SMTP / IMAP Settings
              </button>
              <IconButton label="Settings" onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setSidebarOpen(false)
                }
                setAccountsModalOpen(true)
              }}>
                <Settings />
              </IconButton>
            </div>

            {/* Quick Actions (Install PWA & Shortcuts Help) */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('pwa-open-install'))
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/70 transition cursor-pointer"
                title="Install Progressive Web App on Mobile or Desktop"
              >
                <Download className="size-3.5 text-primary" /> Install App
              </button>
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(true)}
                className="flex items-center justify-center gap-1 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/70 transition cursor-pointer"
                title="View Keyboard Shortcuts (?)"
              >
                <Keyboard className="size-3.5 text-muted-foreground" />
                <span>?</span>
              </button>
            </div>
          </div>
        </aside>
        </>
      )}

      {/* Email List Column (Threaded View) - Hidden on mobile when thread is open */}
      <section className={cn(
        'min-w-0 flex-1 flex-col border-r border-border/70 lg:max-w-[390px]',
        selectedThreadKey ? 'hidden lg:flex' : 'flex'
      )}>
        {/* Static Header & Filter */}
        <header className="flex items-center gap-2 border-b border-border/70 p-3">
          <IconButton label="Toggle sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu />
          </IconButton>

          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages... (/)"
              className="h-9 w-full rounded-xl border border-border/70 bg-muted/30 pl-9 pr-7 text-sm outline-none placeholder:text-muted-foreground focus:border-primary transition"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-4.5 select-none items-center rounded border border-border/80 bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
              /
            </kbd>
          </div>

          <FilterDropdown value={filter} onChange={setFilter} />
        </header>

        <div className="flex items-center gap-1 border-b border-border/70 px-4 py-2">
          <IconButton label="Refresh Sync" onClick={() => handleSync(true)}>
            <RefreshCw className={syncing ? 'animate-spin' : ''} />
          </IconButton>
          <span className="ml-auto text-xs text-muted-foreground">{threads.length} conversations</span>
        </div>

        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold">{folder}</h1>
            <p className="text-xs text-muted-foreground">
              {folder === 'Inbox' ? `${unreadCount} unread` : 'All conversations'}
            </p>
          </div>
        </div>

        {/* Threaded Email Cards Container */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {!mounted || !accountsLoaded || (syncing && threads.length === 0) ? (
            <EmailListSkeleton />
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border/80 m-2">
              <Server className="size-10 text-primary mb-3" />
              <p className="text-sm font-semibold">No Email Account Connected</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Add your Gmail, Outlook, or SMTP/IMAP credentials to start receiving and sending emails.</p>
              <button
                onClick={() => setAccountsModalOpen(true)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm flex items-center gap-2"
              >
                <Plus className="size-4" /> Add SMTP & IMAP Credentials
              </button>
            </div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No emails in {folder} folder.
            </div>
          ) : (
            threads.map((thread) => {
              const latest = thread.latestEmail
              const isSelected = selectedThreadKey === thread.threadKey

              return (
                <div
                  key={thread.threadKey}
                  onClick={() => selectThread(thread)}
                  className={cn(
                    'group relative flex w-full cursor-pointer gap-3 rounded-xl p-3 text-left transition hover:bg-muted/70',
                    isSelected && 'bg-primary/10'
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                      latest.color || 'bg-sky-600'
                    )}
                  >
                    {latest.initials || 'EM'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('truncate text-sm', thread.unread && 'font-semibold')}>
                        {latest.sender_name || latest.sender_email}
                      </span>
                      {thread.count > 1 && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {thread.count}
                        </span>
                      )}
                      {thread.unread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      {thread.starred && (
                        <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400 group-hover:hidden" />
                      )}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground group-hover:hidden">
                        {latest.time}
                      </span>
                      <div className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-lg bg-background/90 px-1 py-0.5 shadow-sm backdrop-blur-sm border border-border/40 group-hover:flex">
                        {folder !== 'Inbox' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              thread.emails.forEach((e) => handleMoveToInbox(e.id))
                            }}
                            title={folder === 'Spam' ? 'Not Spam / Move to Inbox' : 'Move Thread to Inbox'}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary transition"
                          >
                            <Inbox className="size-3.5" />
                          </button>
                        )}
                        {folder !== 'Archive' && folder !== 'Trash' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              thread.emails.forEach((e) => handleArchiveEmail(e.id))
                            }}
                            title="Archive Thread"
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                          >
                            <Archive className="size-3.5" />
                          </button>
                        )}
                        {folder !== 'Spam' && folder !== 'Trash' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              thread.emails.forEach((e) => handleSpamEmail(e.id))
                            }}
                            title="Report Spam"
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-rose-500 transition"
                          >
                            <ShieldAlert className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleStar(latest.id)
                          }}
                          title="Star Thread"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-amber-500 transition"
                        >
                          <Star className={cn('size-3.5', thread.starred && 'fill-amber-400 text-amber-400')} />
                        </button>
                      </div>
                    </div>
                    <p className={cn('truncate text-sm', thread.unread ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                      {thread.subject}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{latest.preview}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {(latest.tags || []).map((tag) => (
                        <span key={tag} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                      {latest.attachment && <Paperclip className="ml-1 size-3 text-muted-foreground" />}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Threaded Email Conversation Reader View */}
      <section className={cn(
        'min-w-0 flex-1 flex-col',
        selectedThreadKey ? 'flex' : 'hidden lg:flex'
      )}>
        {syncing && !selectedThread && threads.length === 0 ? (
          <EmailReaderSkeleton />
        ) : selectedThread ? (
          <>
            <header className="flex items-center gap-1 border-b border-border/70 px-5 py-3">
              <IconButton label="Back" onClick={() => setSelectedThreadKey(null)}>
                <ChevronLeft />
              </IconButton>
              <div className="flex items-center gap-2 min-w-0 ml-2">
                <MessageSquare className="size-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-muted-foreground">
                  {selectedThread.count} {selectedThread.count === 1 ? 'message' : 'messages'} in conversation
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <IconButton
                  label="Reply"
                  onClick={() => {
                    const latest = selectedThread.latestEmail
                    setComposeTo(latest.sender_email)
                    setComposeSubject(`Re: ${selectedThread.subject}`)
                    setComposeOpen(true)
                  }}
                >
                  <Reply />
                </IconButton>
                {folder !== 'Inbox' && (
                  <IconButton
                    label={folder === 'Spam' ? 'Not Spam (Move to Inbox)' : 'Move to Inbox'}
                    onClick={() => {
                      selectedThread.emails.forEach((e) => handleMoveToInbox(e.id))
                      setSelectedThreadKey(null)
                    }}
                  >
                    <Inbox />
                  </IconButton>
                )}
                {folder !== 'Archive' && folder !== 'Trash' && (
                  <IconButton
                    label="Archive Thread"
                    onClick={() => {
                      selectedThread.emails.forEach((e) => handleArchiveEmail(e.id))
                      setSelectedThreadKey(null)
                    }}
                  >
                    <Archive />
                  </IconButton>
                )}
                {folder !== 'Spam' && folder !== 'Trash' && (
                  <IconButton
                    label="Report Spam"
                    onClick={() => {
                      selectedThread.emails.forEach((e) => handleSpamEmail(e.id))
                      setSelectedThreadKey(null)
                    }}
                  >
                    <ShieldAlert />
                  </IconButton>
                )}
                <IconButton
                  label="Mark as unread"
                  onClick={() => {
                    selectedThread.emails.forEach((e) => handleToggleUnread(e.id, true))
                  }}
                >
                  <Mail />
                </IconButton>
                {folder !== 'Trash' && (
                  <IconButton
                    label="Delete Thread"
                    onClick={() => {
                      selectedThread.emails.forEach((e) => handleDeleteEmail(e.id))
                      setSelectedThreadKey(null)
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                )}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-8 py-8 space-y-6">
                {/* Subject Header */}
                <div className="border-b border-border/70 pb-4">
                  <h2 className="text-2xl font-semibold tracking-tight">{selectedThread.subject}</h2>
                </div>

                {/* Conversation Messages Stack (Chronological Order) */}
                {selectedThread.emails.map((msg, index) => (
                  <div
                    key={msg.id}
                    className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition hover:border-border"
                  >
                    <div className="mb-5 flex items-start gap-4">
                      <div
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                          msg.color || 'bg-indigo-600'
                        )}
                      >
                        {msg.initials || 'EM'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">
                              {msg.sender_name || msg.sender_email || 'Sender'}{' '}
                              {msg.sender_email && (
                                <span className="font-normal text-muted-foreground text-xs">&lt;{msg.sender_email}&gt;</span>
                              )}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                              <span>
                                <span className="font-medium text-foreground/80">To:</span> {msg.recipient_to || 'Undisclosed recipient'}
                              </span>
                              {msg.recipient_cc && (
                                <span>
                                  <span className="font-medium text-foreground/80">Cc:</span> {msg.recipient_cc}
                                </span>
                              )}
                              <span>·</span>
                              <span>{msg.time}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleUnread(msg.id, !msg.unread)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                              title={msg.unread ? "Mark as read" : "Mark as unread"}
                            >
                              <Mail className={cn('size-4', msg.unread && 'text-primary fill-primary/20')} />
                            </button>
                            <button onClick={() => toggleStar(msg.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                              <Star className={cn('size-4', msg.starred && 'fill-amber-400 text-amber-400')} />
                            </button>
                            <button
                              onClick={() => {
                                setComposeTo(msg.sender_email)
                                setComposeSubject(`Re: ${selectedThread.subject}`)
                                setComposeOpen(true)
                              }}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                              title="Reply to message"
                            >
                              <Reply className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Email Content Body */}
                    <article className="rich-editor-content text-sm overflow-x-auto text-foreground leading-relaxed">
                      {msg.body_html ? (
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.body_html) }} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.body_text || msg.preview}</p>
                      )}
                    </article>

                    {/* Attachments Card */}
                    {msg.attachment && (
                      <div className="mt-6 border-t border-border/60 pt-4 space-y-2">
                        {Array.isArray(msg.attachment) ? (
                          msg.attachment.map((att: any, idx: number) => (
                            <AttachmentCard key={idx} attachment={att} />
                          ))
                        ) : (
                          <AttachmentCard attachment={msg.attachment} />
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Reply Box at the bottom of conversation */}
                <div className="mt-8">
                  <RichTextEditor
                    value={reply}
                    onChange={setReply}
                    placeholder={`Reply in conversation thread: "${selectedThread.subject}"... (Shortcut: R)`}
                    minHeight="140px"
                    maxHeight="320px"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => {
                        const latest = selectedThread.latestEmail
                        setComposeTo(latest.sender_email)
                        setComposeSubject(`Re: ${selectedThread.subject}`)
                        setComposeBody(reply)
                        setComposeOpen(true)
                        setReply('')
                      }}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
                    >
                      <Send className="size-4" /> Send Reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
              <Mail className="size-6 text-muted-foreground" />
            </div>
            <h2 className="font-semibold">Select a conversation thread</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose a message thread from your inbox to view full conversation history.</p>
          </div>
        )}
      </section>

      {/* Compose Email Modal */}
      {composeOpen && (
        <div className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:right-4 z-50 flex h-[min(620px,calc(100dvh-1rem))] sm:h-[min(620px,calc(100vh-2rem))] w-full sm:w-[580px] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
          <form id="compose-email-form" onSubmit={handleSendEmail} className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-muted/30 px-4 py-3">
              <span className="text-sm font-semibold">New message</span>
              <div className="ml-auto flex items-center gap-1">
                <IconButton
                  label="Close"
                  onClick={() => {
                    setComposeOpen(false)
                    setDraftId(undefined)
                  }}
                >
                  <X />
                </IconButton>
              </div>
            </header>
            <div className="flex shrink-0 flex-col">
              <div className="flex items-center border-b border-border/70 px-4">
                <span className="w-12 text-xs text-muted-foreground">To</span>
                <input
                  type="email"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="h-10 flex-1 bg-transparent text-sm outline-none"
                  placeholder="recipient@domain.com"
                />
              </div>
              <div className="flex items-center border-b border-border/70 px-4">
                <span className="w-12 text-xs text-muted-foreground">Cc</span>
                <input
                  type="email"
                  value={composeCc}
                  onChange={(e) => setComposeCc(e.target.value)}
                  className="h-10 flex-1 bg-transparent text-sm outline-none"
                  placeholder="cc@domain.com (optional)"
                />
              </div>
              <input
                type="text"
                required
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="h-10 border-b border-border/70 bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Subject"
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <RichTextEditor
                value={composeBody}
                onChange={setComposeBody}
                onAttachmentsChange={setComposeAttachments}
                placeholder="Write your message..."
                minHeight="140px"
                className="h-full flex-1 min-h-0"
              />
            </div>
            <footer className="flex shrink-0 items-center gap-2 border-t border-border/70 px-4 py-3">
              <button
                type="submit"
                disabled={sending}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || sending}
                className="rounded-lg border border-border/80 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition cursor-pointer"
              >
                {savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              <IconButton label="Attach file" onClick={() => composeFileInputRef.current?.click()}>
                <Paperclip />
              </IconButton>
              <input
                ref={composeFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleComposeFileSelect}
              />
              <IconButton
                label="Discard draft"
                onClick={() => {
                  setComposeOpen(false)
                  setDraftId(undefined)
                  setComposeTo('')
                  setComposeCc('')
                  setComposeSubject('')
                  setComposeBody('')
                  setComposeAttachments([])
                }}
              >
                <Trash2 />
              </IconButton>
            </footer>
          </form>
        </div>
      )}

      {/* Accounts & SMTP/IMAP Settings Modal */}
      <AccountsModal
        isOpen={accountsModalOpen}
        onClose={() => setAccountsModalOpen(false)}
        onAccountsChange={() => {
          refreshAccounts()
          handleSync(true)
        }}
      />

      {/* User Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onUserUpdate={(updatedUser) => {
          setUser(updatedUser)
          localStorage.setItem('mosaic_cached_user', JSON.stringify(updatedUser))
        }}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <ShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />

      {/* Fancy In-App Notification Toast */}
      <FancyNotificationToast
        email={incomingToastEmail}
        onClose={() => setIncomingToastEmail(null)}
        onView={(email) => {
          const matchingThread = threadsRef.current.find((t) => t.emails.some((em) => em.id === email.id))
          if (matchingThread) {
            selectThread(matchingThread)
          }
        }}
        onArchive={(email) => {
          handleArchiveEmail(email.id)
        }}
      />
    </main>
  )
}
