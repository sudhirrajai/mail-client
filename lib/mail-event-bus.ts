import { EmailItem } from './api'

export type MailEventType =
  | 'EMAIL_STAR_TOGGLED'
  | 'EMAIL_READ_TOGGLED'
  | 'EMAIL_DELETED'
  | 'EMAIL_SENT'
  | 'NEW_EMAILS_RECEIVED'

export interface MailEventPayloads {
  EMAIL_STAR_TOGGLED: { emailId: number; starred: boolean }
  EMAIL_READ_TOGGLED: { emailId: number; unread: boolean }
  EMAIL_DELETED: { emailId: number; email?: EmailItem }
  EMAIL_SENT: { email: EmailItem }
  NEW_EMAILS_RECEIVED: { newEmails: EmailItem[] }
}

type EventCallback<T extends MailEventType> = (payload: MailEventPayloads[T]) => void

class MailEventBus {
  private listeners: { [K in MailEventType]?: Set<EventCallback<K>> } = {}

  on<K extends MailEventType>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set()
    }
    ;(this.listeners[event] as Set<EventCallback<K>>).add(callback)

    // Unsubscribe cleanup function
    return () => {
      ;(this.listeners[event] as Set<EventCallback<K>>)?.delete(callback)
    }
  }

  emit<K extends MailEventType>(event: K, payload: MailEventPayloads[K]): void {
    const eventListeners = this.listeners[event]
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(payload))
    }
  }
}

export const mailEventBus = new MailEventBus()
