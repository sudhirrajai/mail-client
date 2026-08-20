import { EmailItem } from './api'
import { mailEventBus } from './mail-event-bus'

interface CacheEntry {
  emails: EmailItem[]
  timestamp: number
}

class EmailCacheManager {
  private cache: Map<string, CacheEntry> = new Map()
  private TTL = 5 * 60 * 1000 // 5 minutes freshness threshold for event-driven observer cache

  constructor() {
    this.setupObserverListeners()
  }

  private setupObserverListeners(): void {
    // Observer 1: Star Toggle Event
    mailEventBus.on('EMAIL_STAR_TOGGLED', ({ emailId, starred }) => {
      this.cache.forEach((entry, key) => {
        const isStarredFolder = key.includes('_Starred_')

        if (isStarredFolder) {
          if (!starred) {
            entry.emails = entry.emails.filter((e) => e.id !== emailId)
          }
        } else {
          entry.emails = entry.emails.map((e) => (e.id === emailId ? { ...e, starred } : e))
        }
      })
    })

    // Observer 2: Read Toggle Event
    mailEventBus.on('EMAIL_READ_TOGGLED', ({ emailId, unread }) => {
      this.cache.forEach((entry) => {
        entry.emails = entry.emails.map((e) => (e.id === emailId ? { ...e, unread } : e))
      })
    })

    // Observer 3: Delete Email Event (Moves email to Trash in cache, removes from Inbox/Sent/Starred)
    mailEventBus.on('EMAIL_DELETED', ({ emailId, email }) => {
      this.cache.forEach((entry, key) => {
        const isTrashFolder = key.includes('_Trash_')

        if (isTrashFolder) {
          if (email && email.folder !== 'Trash') {
            const trashItem: EmailItem = { ...email, folder: 'Trash' }
            entry.emails = [trashItem, ...entry.emails.filter((e) => e.id !== emailId)]
          } else {
            // Hard delete from Trash
            entry.emails = entry.emails.filter((e) => e.id !== emailId)
          }
        } else {
          // Instantly filter out deleted email from all non-Trash folders (Inbox, Sent, Starred, etc.)
          entry.emails = entry.emails.filter((e) => e.id !== emailId)
        }
      })
    })

    // Observer 4: Sent Email Event
    mailEventBus.on('EMAIL_SENT', ({ email }) => {
      this.cache.forEach((entry, key) => {
        if (key.includes('_Sent_')) {
          entry.emails = [email, ...entry.emails.filter((e) => e.id !== email.id)]
        }
      })
    })

    // Observer 5: New Emails Received Event
    mailEventBus.on('NEW_EMAILS_RECEIVED', ({ newEmails }) => {
      this.cache.forEach((entry, key) => {
        if (key.includes('_Inbox_')) {
          const existingIds = new Set(entry.emails.map((e) => e.id))
          const fresh = newEmails.filter((e) => !existingIds.has(e.id))
          if (fresh.length > 0) {
            entry.emails = [...fresh, ...entry.emails]
          }
        }
      })
    })
  }

  private buildKey(accountId: number | undefined, folder: string, query: string, filter: string): string {
    return `${accountId || 'default'}_${folder}_${query.trim().toLowerCase()}_${filter}`
  }

  has(accountId: number | undefined, folder: string, query: string = '', filter: string = 'All'): boolean {
    const key = this.buildKey(accountId, folder, query, filter)
    return this.cache.has(key)
  }

  get(accountId: number | undefined, folder: string, query: string = '', filter: string = 'All'): EmailItem[] | null {
    const key = this.buildKey(accountId, folder, query, filter)
    const entry = this.cache.get(key)
    if (!entry) return null
    return entry.emails
  }

  isValid(accountId: number | undefined, folder: string, query: string = '', filter: string = 'All'): boolean {
    const key = this.buildKey(accountId, folder, query, filter)
    const entry = this.cache.get(key)
    if (!entry) return false
    return Date.now() - entry.timestamp < this.TTL
  }

  set(accountId: number | undefined, folder: string, query: string = '', filter: string = 'All', emails: EmailItem[]): void {
    const key = this.buildKey(accountId, folder, query, filter)
    this.cache.set(key, {
      emails,
      timestamp: Date.now(),
    })
  }

  clear(): void {
    this.cache.clear()
  }
}

export const emailCache = new EmailCacheManager()
