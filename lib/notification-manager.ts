/**
 * Notification Manager for Mosaic Webmail
 * Handles:
 * 1. Web Audio API synthesized glass chime (zero external audio files needed)
 * 2. Native OS Web Notifications (Desktop, Laptop & Mobile PWA)
 * 3. Native PWA Badging API (Windows Taskbar, macOS Dock, Phone Home Screen)
 * 4. Dynamic HTML5 Canvas Favicon Notification Dot
 * 5. Tab Title Counter
 */

class NotificationManager {
  private audioCtx: AudioContext | null = null
  private isAudioUnlocked = false

  constructor() {
    if (typeof window !== 'undefined') {
      // Auto-unlock audio context on first user interaction anywhere on the page
      const unlockAudio = () => {
        this.getAudioContext()
        window.removeEventListener('click', unlockAudio)
        window.removeEventListener('keydown', unlockAudio)
        window.removeEventListener('touchstart', unlockAudio)
      }
      window.addEventListener('click', unlockAudio)
      window.addEventListener('keydown', unlockAudio)
      window.addEventListener('touchstart', unlockAudio)
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass()
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        this.isAudioUnlocked = true
      })
    }
    return this.audioCtx
  }

  /**
   * Play an elegant, modern double-harmonic glass chime
   */
  playChime(): void {
    try {
      const ctx = this.getAudioContext()
      if (!ctx) return

      const now = ctx.currentTime

      // Fundamental tone (830Hz rising smoothly to 1050Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(830, now)
      osc1.frequency.exponentialRampToValueAtTime(1050, now + 0.08)

      gain1.gain.setValueAtTime(0.18, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.4)

      // Harmonic crystalline overtone (1320Hz bell shimmer)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(1320, now + 0.06)
      osc2.frequency.exponentialRampToValueAtTime(1480, now + 0.12)

      gain2.gain.setValueAtTime(0.12, now + 0.06)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48)

      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.06)
      osc2.stop(now + 0.48)
    } catch (err) {
      console.warn('[NotificationManager] Audio chime could not play:', err)
    }
  }

  /**
   * Request Native OS Notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }

    return false
  }

  /**
   * Show OS Notification (Windows banner, Mac banner, Android notification)
   */
  showOsNotification(title: string, body: string, emailId: number, onClick?: () => void): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    try {
      const notif = new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: `mosaic-email-${emailId}`,
      })

      notif.onclick = () => {
        window.focus()
        if (onClick) onClick()
        notif.close()
      }
    } catch (err) {
      console.warn('[NotificationManager] OS Notification error:', err)
    }
  }

  /**
   * Native PWA Badging API for Taskbar / Mac Dock / Phone Home Screen
   */
  updateAppBadge(unreadCount: number): void {
    if (typeof window === 'undefined') return

    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        navigator.setAppBadge(unreadCount).catch(() => {})
      } else {
        navigator.clearAppBadge().catch(() => {})
      }
    }
  }

  /**
   * Dynamically paint an unread notification dot onto the browser tab's favicon
   */
  updateFaviconDot(hasUnread: boolean): void {
    if (typeof window === 'undefined') return

    const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (!favicon) return

    if (!hasUnread) {
      favicon.href = '/icons/icon-192x192.png'
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = '/icons/icon-192x192.png'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Draw original icon
      ctx.drawImage(img, 0, 0, 64, 64)

      // Draw glowing unread indicator dot (top-right corner)
      ctx.beginPath()
      ctx.arc(52, 12, 10, 0, 2 * Math.PI)
      ctx.fillStyle = '#ef4444' // Vibrant red
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()

      favicon.href = canvas.toDataURL('image/png')
    }
  }

  /**
   * Update browser tab title with unread counter
   */
  updateTabTitle(unreadCount: number, currentFolder = 'Inbox'): void {
    if (typeof window === 'undefined') return

    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${currentFolder} — Mosaic Mail`
    } else {
      document.title = 'Mosaic Mail — Focused email, beautifully organized'
    }
  }
}

export const notificationManager = new NotificationManager()
