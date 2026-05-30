// Captures the browser's `beforeinstallprompt` so a custom "Install app" button
// can trigger it later (Chrome/Edge/Android only — iOS Safari has no API).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  listeners.forEach((l) => l())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  listeners.forEach((l) => l())
})

export function canInstall(): boolean {
  return deferred != null
}

/** Subscribe to install-availability changes. Returns an unsubscribe fn. */
export function onInstallChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Show the native install prompt. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  listeners.forEach((l) => l())
  return outcome === 'accepted'
}
