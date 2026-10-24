'use client'

import { useEffect, useState } from 'react'
import { Download, Monitor, Smartphone, X, Check } from 'lucide-react'

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered:', reg.scope)
          })
          .catch((err) => {
            console.error('[PWA] Service Worker registration failed:', err)
          })
      })
    }

    // 2. Check if already running in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    if (isStandalone) {
      setIsInstalled(true)
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIos(isIosDevice)

    // 4. Capture beforeinstallprompt (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
      // Expose to window so other components (e.g. sidebar) can trigger it
      ;(window as any).__pwaInstallPrompt = e
      window.dispatchEvent(new CustomEvent('pwa-installable'))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // 5. Track appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
      setShowInstallModal(false)
      console.log('[PWA] App successfully installed')
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    // 6. Online / Offline status
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (!navigator.onLine) setIsOffline(true)

    // Listen for custom trigger to open install modal from anywhere in the app
    const handleOpenInstall = () => setShowInstallModal(true)
    window.addEventListener('pwa-open-install', handleOpenInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('pwa-open-install', handleOpenInstall)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If iOS or unsupported browser, show instructions modal
      setShowInstallModal(true)
      return
    }

    try {
      deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
        setIsInstallable(false)
      }
      setDeferredPrompt(null)
    } catch (e) {
      console.error('[PWA] Prompt failed:', e)
    }
  }

  return (
    <>
      {/* Offline Toast Banner */}
      {isOffline && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/90 px-4 py-2 text-xs font-medium text-amber-200 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom">
          <span className="size-2 rounded-full bg-amber-400 animate-ping" />
          Offline Mode — Viewing cached messages
        </div>
      )}

      {/* Manual Install Instructions Modal (for iOS or Desktop Chrome/Safari) */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl">
            <button
              onClick={() => setShowInstallModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Download className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base">Install Mosaic Webmail</h3>
                <p className="text-xs text-muted-foreground">Run as a native app on your phone, tablet, or PC</p>
              </div>
            </div>

            {deferredPrompt ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click the button below to install Mosaic Webmail directly to your home screen or desktop application dock.
                </p>
                <button
                  onClick={handleInstallClick}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-95 transition"
                >
                  <Download className="size-4" /> Install Now
                </button>
              </div>
            ) : isIos ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Smartphone className="size-4 text-primary" /> How to install on iPhone & iPad:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>Tap the <strong>Share</strong> button (box with arrow pointing up) at the bottom of Safari.</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top-right corner.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Monitor className="size-4 text-primary" /> How to install on Desktop / Laptop:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>In <strong>Chrome</strong> or <strong>Edge</strong>, look for the <strong>Install</strong> icon in the right side of the address bar.</li>
                  <li>Click <strong>Install Mosaic Webmail</strong> to launch in a clean, distraction-free native app window.</li>
                  <li>You can now pin it to your Windows Taskbar, Mac Dock, or Start Menu!</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
