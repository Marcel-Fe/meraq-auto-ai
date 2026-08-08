import { useEffect, useState } from 'react'
import { Skeleton } from '../../components/ui'
import { findPartImage } from '../../lib/partImage'
import type { ManualHotspot, PartWebImage } from '../../types'

/**
 * „Wie sieht es aus?" – ein reales Foto zum Bauteil.
 *
 * Das Modell zeigt, wo etwas sitzt; erkennen muss der Nutzer es am eigenen
 * Fahrzeug trotzdem. Das Foto kommt aus Wikimedia Commons und steht immer mit
 * Urheber und Lizenz da – ohne die dürfte es nicht gezeigt werden.
 *
 * Findet die Suche nichts, erscheint gar nichts. Ein falsches Bauteilfoto wäre
 * schlimmer als keines: Der Nutzer sucht danach unter seiner Motorhaube.
 */
export function PartPhoto({ hotspot }: { hotspot: ManualHotspot }) {
  const [image, setImage] = useState<PartWebImage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setImage(null)
    setLoading(true)
    findPartImage(hotspot, controller.signal)
      .then((found) => {
        if (!controller.signal.aborted) setImage(found)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [hotspot])

  if (loading) return <Skeleton className="h-40 w-full rounded-[16px]" />
  if (!image) return null

  return (
    <figure className="space-y-1.5">
      <img
        src={image.dataUrl}
        alt={`Beispielfoto: ${hotspot.label}`}
        className="max-h-52 w-full rounded-[16px] border border-white/8 object-cover"
      />
      <figcaption className="text-[11px] leading-relaxed text-ink-faint">
        Foto: {image.author} ·{' '}
        {image.pageUrl ? (
          <a
            href={image.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="text-brand-blue underline-offset-2 hover:underline"
          >
            {image.license}
          </a>
        ) : (
          image.license
        )}{' '}
        · Beispiel aus Wikimedia Commons. An Deinem Fahrzeug kann das Bauteil anders aussehen.
      </figcaption>
    </figure>
  )
}
