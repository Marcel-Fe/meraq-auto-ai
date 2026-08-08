/**
 * Vollbild auf dem Handy – ohne Uhrzeit, Akku und Adressleiste darüber.
 *
 * Drei Wege, je nachdem wie die App geöffnet wurde:
 *
 * - **Vom Homescreen (Android):** `display: fullscreen` im Manifest reicht, das
 *   System blendet die Leisten selbst aus. Hier passiert dann nichts mehr.
 * - **Im Browser (Android):** Nur die Fullscreen-API hilft, und die verlangt
 *   eine Nutzergeste – deshalb der erste Fingertipp.
 * - **iPhone:** Die Statusleiste lässt sich in einer Web-App nicht ausblenden;
 *   Apple erlaubt `requestFullscreen` dort nur für Videos. Mit
 *   `black-translucent` (index.html) liegt sie wenigstens durchsichtig über dem
 *   App-Hintergrund statt in einem eigenen Balken.
 *
 * Am Schreibtisch bleibt alles wie es ist: Ein Browserfenster ungefragt auf
 * Vollbild zu ziehen wäre übergriffig.
 */
export function enableFullscreenOnFirstTouch() {
  const root = document.documentElement
  if (!root.requestFullscreen || !document.fullscreenEnabled) return

  const alreadyImmersive = () =>
    !!document.fullscreenElement ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches

  // Nur auf Geräten, die man in der Hand hält – und nicht in einem
  // ferngesteuerten Browser: Die Prüfskripte messen sonst ein anderes Fenster,
  // als der Nutzer vor sich hat.
  const handheld = window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 900
  if (!handheld || navigator.webdriver || alreadyImmersive()) return

  const request = () => {
    window.removeEventListener('pointerdown', request)
    if (alreadyImmersive()) return
    // Lehnt der Browser ab (iOS tut das), bleibt es beim bisherigen Verhalten
    root.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined)
  }

  window.addEventListener('pointerdown', request, { once: true })
}
